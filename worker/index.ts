/**
 * Sprinkle API.
 *
 * One endpoint does the work: POST /api/find-donation-matches. It streams
 * server-sent events so the UI can show real progress instead of a spinner,
 * because a full research pass takes a while and silence feels broken.
 */

import { parseDonation } from './parse'
import { discoverOrganizations, type DiscoveredOrg } from './discover'
import { researchBatch, BATCH_SIZE, type ResearchedOrg } from './research'
import { matchOrganizations } from './match'
import { ResearchCache } from './cache'
import { GeminiError } from './gemini'
import {
  MAX_DONATION_TEXT,
  MAX_LOCATION_TEXT,
  type SearchRequest,
  type SearchResult,
  type StreamEvent,
} from '../shared/types'

export interface Env {
  ASSETS: Fetcher
  SPRINKLE_CACHE?: KVNamespace
  GEMINI_API_KEY: string
  GEMINI_RESEARCH_MODEL?: string
  GEMINI_PARSE_MODEL?: string
  MAX_ORGS_RESEARCHED?: string
  RATE_LIMIT_SECONDS?: string
}

const DEFAULT_RESEARCH_MODEL = 'gemini-3.7-flash'
const DEFAULT_PARSE_MODEL = 'gemini-3.5-flash-lite'
const DEFAULT_MAX_ORGS = 8
const DEFAULT_RATE_LIMIT_SECONDS = 30
/** Comment frames go out this often so a long research batch cannot idle out. */
const HEARTBEAT_MS = 15_000

function numberFrom(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** Validates the request body and returns a clean version or an error string. */
function validate(body: unknown): { ok: true; value: SearchRequest } | { ok: false; error: string } {
  if (typeof body !== 'object' || body === null) {
    return { ok: false, error: 'Expected a JSON object.' }
  }
  const { location, donationText, refresh } = body as Record<string, unknown>

  if (typeof location !== 'string' || !location.trim()) {
    return { ok: false, error: 'Add a ZIP code or a city and state so Sprinkle knows where to look.' }
  }
  if (location.trim().length > MAX_LOCATION_TEXT) {
    return { ok: false, error: 'That location is too long. A ZIP code or "City, ST" is enough.' }
  }
  if (typeof donationText !== 'string' || donationText.trim().length < 3) {
    return { ok: false, error: 'Tell Sprinkle what you have to give.' }
  }
  if (donationText.trim().length > MAX_DONATION_TEXT) {
    return {
      ok: false,
      error: `That description is a bit long. Keep it under ${MAX_DONATION_TEXT} characters.`,
    }
  }

  return {
    ok: true,
    value: {
      location: location.trim(),
      donationText: donationText.trim(),
      refresh: refresh === true,
    },
  }
}

/**
 * One research request per IP per window. KV is eventually consistent, so this
 * is a speed bump against scripted abuse rather than a hard guarantee. That is
 * the right trade here: the goal is protecting the API budget, not perfect
 * fairness between two requests landing in the same second.
 */
async function checkRateLimit(
  env: Env,
  request: Request,
  windowSeconds: number,
): Promise<number | null> {
  if (!env.SPRINKLE_CACHE) return null
  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown'
  const key = `rl:${ip}`

  const last = await env.SPRINKLE_CACHE.get(key)
  if (last) {
    const elapsed = (Date.now() - Number(last)) / 1000
    const remaining = Math.ceil(windowSeconds - elapsed)
    if (remaining > 0) return remaining
  }

  await env.SPRINKLE_CACHE.put(key, String(Date.now()), { expirationTtl: 60 })
  return null
}

/**
 * Upstream errors carry API detail that is noise to a person donating a coat.
 * Map them to something actionable and keep the raw text in the logs.
 */
function friendlyError(err: unknown): string {
  if (err instanceof GeminiError) {
    if (err.status === 401 || err.status === 403) {
      return 'Sprinkle’s connection to Gemini was rejected. The API key needs a look.'
    }
    if (err.status === 429) {
      return 'Sprinkle has hit its research limit for now. Try again in a few minutes.'
    }
    if (err.status && err.status >= 500) {
      return 'Gemini is having trouble right now. Give it a minute and try again.'
    }
    if (err.message.includes('too long')) {
      return 'That search took longer than Sprinkle could wait. Try again, or narrow the list down.'
    }
    return 'Sprinkle could not finish researching. Try that search again.'
  }
  return 'Something went wrong during the search. Try that again.'
}

function sseHeaders(): HeadersInit {
  return {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-store',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  }
}

async function handleSearch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  if (!env.GEMINI_API_KEY) {
    return json({ error: 'Sprinkle is missing its Gemini API key. Set GEMINI_API_KEY.' }, 500)
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Could not read that request.' }, 400)
  }

  const checked = validate(body)
  if (!checked.ok) return json({ error: checked.error }, 400)

  const rateWindow = numberFrom(env.RATE_LIMIT_SECONDS, DEFAULT_RATE_LIMIT_SECONDS)
  const retryAfter = await checkRateLimit(env, request, rateWindow)
  if (retryAfter !== null) {
    return json(
      {
        error: `Sprinkle is catching its breath. Try again in ${retryAfter} second${retryAfter === 1 ? '' : 's'}.`,
        retryAfterSeconds: retryAfter,
      },
      429,
    )
  }

  const { readable, writable } = new TransformStream()
  const writer = writable.getWriter()
  const encoder = new TextEncoder()
  let streamClosed = false

  const send = async (event: StreamEvent) => {
    if (streamClosed) return
    await writer.write(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
  }

  /**
   * A single research batch can run for a couple of minutes without producing
   * an event, and a connection that goes quiet for around 100 seconds gets
   * dropped. These comment frames keep it open. SSE parsers ignore any frame
   * with no `data:` line, so this costs the client nothing.
   */
  const heartbeat = setInterval(() => {
    if (streamClosed) return
    writer.write(encoder.encode(': ping\n\n')).catch(() => {})
  }, HEARTBEAT_MS)

  ctx.waitUntil(
    runPipeline(env, checked.value, send)
      .catch((err: unknown) => {
        // The full error goes to the Worker log; the person gets something readable.
        console.error('Sprinkle search failed:', err)
        return send({ type: 'error', message: friendlyError(err) })
      })
      .finally(async () => {
        streamClosed = true
        clearInterval(heartbeat)
        await writer.close().catch(() => {})
      }),
  )

  return new Response(readable, { headers: sseHeaders() })
}

async function runPipeline(
  env: Env,
  req: SearchRequest,
  send: (event: StreamEvent) => Promise<void>,
): Promise<void> {
  const apiKey = env.GEMINI_API_KEY
  const researchModel = env.GEMINI_RESEARCH_MODEL || DEFAULT_RESEARCH_MODEL
  const parseModel = env.GEMINI_PARSE_MODEL || DEFAULT_PARSE_MODEL
  const maxOrgs = numberFrom(env.MAX_ORGS_RESEARCHED, DEFAULT_MAX_ORGS)
  const cache = new ResearchCache(env.SPRINKLE_CACHE)
  const warnings: string[] = []

  // Stage 1: understand what the person actually has.
  await send({ type: 'progress', stage: 'parsing', message: 'Reading your list' })
  const items = await parseDonation(apiKey, parseModel, req.donationText)
  if (items.length === 0) {
    await send({
      type: 'error',
      message: "Sprinkle couldn't pick out any donatable items from that. Try naming a few things directly, like \"two winter coats and canned food\".",
    })
    return
  }
  await send({ type: 'items', items })

  // Stage 2: find candidate organizations, reusing the area's list when fresh.
  await send({
    type: 'progress',
    stage: 'discovering',
    message: `Looking for organizations near ${req.location}`,
  })

  let discovered: DiscoveredOrg[] | null = req.refresh ? null : await cache.getDiscovery(req.location)
  if (!discovered || discovered.length === 0) {
    discovered = await discoverOrganizations(apiKey, researchModel, req.location, items, maxOrgs)
    if (discovered.length > 0) await cache.putDiscovery(req.location, discovered)
  }

  if (discovered.length === 0) {
    await send({
      type: 'error',
      message: `Sprinkle couldn't find organizations near "${req.location}". Try a nearby city and state, or a different ZIP code.`,
    })
    return
  }

  const candidates = discovered.slice(0, maxOrgs)
  await send({
    type: 'orgs-found',
    count: candidates.length,
    names: candidates.map((org) => org.name),
  })

  // Stage 3: research each one, pulling from cache where we already have it.
  await send({
    type: 'progress',
    stage: 'researching',
    message: 'Checking what each one currently accepts',
  })

  const researched: { research: ResearchedOrg; researchedAt: string; fromCache: boolean }[] = []
  const needsResearch: DiscoveredOrg[] = []

  for (const org of candidates) {
    const cached = req.refresh ? null : await cache.getResearch(org.name)
    if (cached) {
      researched.push({ research: cached.org, researchedAt: cached.researchedAt, fromCache: true })
      await send({
        type: 'org-researched',
        name: org.name,
        index: researched.length,
        total: candidates.length,
        fromCache: true,
      })
    } else {
      needsResearch.push(org)
    }
  }

  const now = new Date().toISOString()
  for (let i = 0; i < needsResearch.length; i += BATCH_SIZE) {
    const batch = needsResearch.slice(i, i + BATCH_SIZE)
    const results = await researchBatch(apiKey, researchModel, batch)
    for (const result of results) {
      researched.push({ research: result, researchedAt: now, fromCache: false })
      if (result.verification !== 'unknown') await cache.putResearch(result, now)
      await send({
        type: 'org-researched',
        name: result.name,
        index: researched.length,
        total: candidates.length,
        fromCache: false,
      })
    }
  }

  if (researched.every((r) => r.research.verification === 'unknown')) {
    warnings.push('Sprinkle found these organizations but could not confirm current donation policies for any of them. Call before you drive over.')
  }

  // Stage 4: match items against organizations and rank the results.
  await send({ type: 'progress', stage: 'matching', message: 'Matching your items' })
  const organizations = await matchOrganizations(apiKey, researchModel, items, researched)

  const result: SearchResult = {
    location: req.location,
    items,
    organizations,
    searchedAt: new Date().toISOString(),
    fullyCached: researched.length > 0 && researched.every((r) => r.fromCache),
    ...(warnings.length > 0 ? { warnings } : {}),
  }

  await send({ type: 'result', result })
  await send({ type: 'progress', stage: 'done', message: 'Done' })
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname === '/api/find-donation-matches') {
      if (request.method !== 'POST') {
        return json({ error: 'Use POST.' }, 405)
      }
      return handleSearch(request, env, ctx)
    }

    if (url.pathname === '/api/health') {
      return json({ ok: true, hasKey: Boolean(env.GEMINI_API_KEY), hasCache: Boolean(env.SPRINKLE_CACHE) })
    }

    if (url.pathname.startsWith('/api/')) {
      return json({ error: 'Not found.' }, 404)
    }

    return env.ASSETS.fetch(request)
  },
} satisfies ExportedHandler<Env>
