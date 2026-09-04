/**
 * Minimal REST client for the Gemini Interactions API.
 *
 * We call the endpoint directly with fetch rather than pulling in the SDK.
 * It is a handful of fields, it keeps the Worker bundle tiny, and it means
 * the exact request body is visible right here when something goes wrong.
 *
 * Docs: https://ai.google.dev/gemini-api/docs/interactions
 */

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/interactions'
const API_REVISION = '2026-05-20'

export type GeminiTool =
  | { type: 'google_search' }
  | { type: 'url_context' }

export interface GeminiCallOptions {
  apiKey: string
  model: string
  input: string
  systemInstruction?: string
  tools?: GeminiTool[]
  /** JSON Schema for structured output. Omit for plain text. */
  schema?: Record<string, unknown>
  /**
   * Lower thinking for the mechanical stages (parsing a list, matching items
   * against an already-researched policy) keeps latency and token spend down.
   * Leave unset for the research stage, which genuinely needs to reason.
   */
  thinkingLevel?: 'low' | 'medium' | 'high'
  /** Aborts the request if Gemini takes too long. Defaults to 60s. */
  timeoutMs?: number
}

export interface GeminiCallResult<T> {
  data: T
  /** Every url_citation annotation found in the response, deduped by URL. */
  citations: { title: string; url: string }[]
  usage?: { input_tokens?: number; output_tokens?: number; total_tokens?: number }
}

interface Annotation {
  type?: string
  title?: string
  url?: string
}

interface ContentBlock {
  type?: string
  text?: string
  annotations?: Annotation[]
}

interface Step {
  type?: string
  content?: ContentBlock[]
}

interface InteractionResponse {
  steps?: Step[]
  usage?: { input_tokens?: number; output_tokens?: number; total_tokens?: number }
  error?: { message?: string }
}

export class GeminiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message)
    this.name = 'GeminiError'
  }
}

/**
 * Rebuilds the SDK's `output_text` helper: the text of the trailing
 * model_output steps, joined. Tool steps in the middle are skipped.
 */
function outputText(res: InteractionResponse): string {
  const steps = res.steps ?? []
  const parts: string[] = []
  for (let i = steps.length - 1; i >= 0; i--) {
    const step = steps[i]
    if (step.type !== 'model_output') {
      if (parts.length > 0) break
      continue
    }
    const text = (step.content ?? [])
      .filter((c) => c.type === 'text' && typeof c.text === 'string')
      .map((c) => c.text as string)
      .join('')
    if (text) parts.unshift(text)
  }
  return parts.join('')
}

function collectCitations(res: InteractionResponse): { title: string; url: string }[] {
  const seen = new Map<string, string>()
  for (const step of res.steps ?? []) {
    for (const block of step.content ?? []) {
      for (const ann of block.annotations ?? []) {
        if (ann.type === 'url_citation' && ann.url && !seen.has(ann.url)) {
          seen.set(ann.url, ann.title || hostnameOf(ann.url))
        }
      }
    }
  }
  return [...seen].map(([url, title]) => ({ url, title }))
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

/**
 * Models wrapped in ```json fences happen even with a response schema set,
 * and a stray leading sentence happens too. Pull out the JSON either way.
 */
function parseJsonLoosely<T>(raw: string): T {
  const trimmed = raw.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)
  const candidate = fenced ? fenced[1].trim() : trimmed
  try {
    return JSON.parse(candidate) as T
  } catch {
    const start = candidate.search(/[[{]/)
    const end = Math.max(candidate.lastIndexOf(']'), candidate.lastIndexOf('}'))
    if (start !== -1 && end > start) {
      return JSON.parse(candidate.slice(start, end + 1)) as T
    }
    throw new GeminiError('Gemini returned a response that was not valid JSON.')
  }
}

async function callInteractions(opts: GeminiCallOptions): Promise<InteractionResponse> {
  const body: Record<string, unknown> = {
    model: opts.model,
    input: opts.input,
    // Donation descriptions are personal. Do not let them sit on Google's side.
    store: false,
  }
  if (opts.systemInstruction) body.system_instruction = opts.systemInstruction
  if (opts.tools?.length) body.tools = opts.tools
  if (opts.thinkingLevel) body.generation_config = { thinking_level: opts.thinkingLevel }
  if (opts.schema) {
    body.response_format = {
      type: 'text',
      mime_type: 'application/json',
      schema: opts.schema,
    }
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? 60_000)

  let res: Response
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'x-goog-api-key': opts.apiKey,
        'Content-Type': 'application/json',
        'Api-Revision': API_REVISION,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new GeminiError('Gemini took too long to respond.')
    }
    throw new GeminiError(`Could not reach Gemini: ${(err as Error).message}`)
  } finally {
    clearTimeout(timeout)
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new GeminiError(
      `Gemini returned ${res.status}. ${detail.slice(0, 300)}`,
      res.status,
    )
  }

  return (await res.json()) as InteractionResponse
}

/** Calls Gemini and parses the response as JSON matching `schema`. */
export async function generateJson<T>(opts: GeminiCallOptions): Promise<GeminiCallResult<T>> {
  const res = await callInteractions(opts)
  if (res.error?.message) throw new GeminiError(res.error.message)

  const text = outputText(res)
  if (!text) throw new GeminiError('Gemini returned an empty response.')

  return {
    data: parseJsonLoosely<T>(text),
    citations: collectCitations(res),
    usage: res.usage,
  }
}
