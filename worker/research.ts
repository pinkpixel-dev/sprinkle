import { generateJson } from './gemini'
import { researchSchema } from './schemas'
import type { DiscoveredOrg } from './discover'
import type { OrgType, Source, VerificationStatus } from '../shared/types'

const SYSTEM = `You research what local organizations currently accept as donations, and you report only what you can support with a source.

For each organization, search for its official site and its donation page, then read those pages with the URL context tool. Look for accepted items, items they refuse, drop-off details, and any current needs or wish list.

Verification status, and be honest about it:
- "confirmed": you read the organization's own current page and it states the donation policy.
- "likely": a credible third party (news, a city or United Way listing, a well-maintained directory) documents it, but the organization's own site did not confirm it.
- "call-first": the organization is real and relevant, but the donation information is incomplete, outdated, or contradicts itself across sources.
- "unknown": you could not find any usable donation policy.

Hard rules:
- Never invent an accepted item, a needs list, a phone number, or a URL. Every URL in sources must be one you actually retrieved.
- currentNeeds is for an actual posted wish list or "most needed items" list. If there is no such list, return an empty array. Do not infer a needs list from what the organization generally accepts.
- rejectedItems only when the organization explicitly says it will not take something.
- verificationNote is one plain sentence a person can read, like "Their donation page lists accepted items and was updated this season."
- Keep every organization you were given, even the ones where you found nothing. Return them with "unknown" rather than dropping them.`

export interface ResearchedOrg {
  name: string
  type: OrgType
  location: string
  address?: string
  phone?: string
  website?: string
  donationPageUrl?: string
  acceptedItems: string[]
  rejectedItems: string[]
  currentNeeds: string[]
  dropOffInstructions?: string
  dropOffHours?: string
  appointmentRequired?: boolean
  verification: VerificationStatus
  verificationNote: string
  sources: Source[]
}

interface ResearchResponse {
  organizations: ResearchedOrg[]
}

/** How many organizations go into one Gemini research call. */
const BATCH_SIZE = 3

function describeBatch(orgs: DiscoveredOrg[]): string {
  return orgs
    .map((org, i) => {
      const lines = [`${i + 1}. ${org.name} (${org.type}) - ${org.location}`]
      if (org.address) lines.push(`   Address: ${org.address}`)
      if (org.website) lines.push(`   Possible website: ${org.website}`)
      return lines.join('\n')
    })
    .join('\n')
}

function sanitize(org: ResearchedOrg, fallback: DiscoveredOrg): ResearchedOrg {
  const validSources = (org.sources ?? []).filter((s) => {
    if (!s?.url) return false
    try {
      const url = new URL(s.url)
      return url.protocol === 'https:' || url.protocol === 'http:'
    } catch {
      return false
    }
  })

  // A "confirmed" claim with nothing to click is not confirmed.
  const verification: VerificationStatus =
    validSources.length === 0 && org.verification !== 'unknown'
      ? 'call-first'
      : (org.verification ?? 'unknown')

  return {
    ...org,
    name: org.name?.trim() || fallback.name,
    type: org.type ?? fallback.type,
    location: org.location?.trim() || fallback.location,
    acceptedItems: (org.acceptedItems ?? []).filter(Boolean).slice(0, 20),
    rejectedItems: (org.rejectedItems ?? []).filter(Boolean).slice(0, 20),
    currentNeeds: (org.currentNeeds ?? []).filter(Boolean).slice(0, 20),
    verification,
    verificationNote:
      org.verificationNote?.trim() ||
      'No current donation information was found for this organization.',
    sources: validSources.slice(0, 6),
  }
}

/** A placeholder for an organization whose research call failed outright. */
function unresearched(org: DiscoveredOrg): ResearchedOrg {
  return {
    name: org.name,
    type: org.type,
    location: org.location,
    ...(org.address ? { address: org.address } : {}),
    ...(org.website ? { website: org.website } : {}),
    acceptedItems: [],
    rejectedItems: [],
    currentNeeds: [],
    verification: 'unknown',
    verificationNote: 'Sprinkle could not reach any current information for this organization.',
    sources: [],
  }
}

/**
 * Stage two: research a batch of organizations with search plus page reading.
 * Batching keeps the number of grounded requests down without losing per-org
 * detail, since each organization still gets its own searches inside the call.
 */
export async function researchBatch(
  apiKey: string,
  model: string,
  orgs: DiscoveredOrg[],
): Promise<ResearchedOrg[]> {
  const input = `Research these ${orgs.length} organizations and report their current donation policies.

${describeBatch(orgs)}

Return one entry per organization, in the same order.`

  try {
    const { data } = await generateJson<ResearchResponse>({
      apiKey,
      model,
      systemInstruction: SYSTEM,
      input,
      tools: [{ type: 'google_search' }, { type: 'url_context' }],
      schema: researchSchema,
      timeoutMs: 120_000,
    })

    const returned = data.organizations ?? []
    return orgs.map((wanted, i) => {
      const match =
        returned.find(
          (r) => r?.name?.trim().toLowerCase() === wanted.name.trim().toLowerCase(),
        ) ?? returned[i]
      return match ? sanitize(match, wanted) : unresearched(wanted)
    })
  } catch {
    // One failed batch should not sink the whole search.
    return orgs.map(unresearched)
  }
}

export { BATCH_SIZE }
