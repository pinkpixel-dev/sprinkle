/**
 * KV-backed research cache.
 *
 * Researching an organization is the expensive part of a search. Matching an
 * already-researched organization against a new list of items is cheap. So we
 * cache the research and re-run only the matching.
 *
 * One record per organization rather than separate policy and needs records.
 * A single Gemini call produces both, so splitting them would mean two calls
 * to fill two caches that always expire together in practice.
 */

import type { DiscoveredOrg } from './discover'
import type { ResearchedOrg } from './research'

/** Candidate organizations for an area. Slow-changing, so keep it a while. */
const DISCOVERY_TTL_SECONDS = 5 * 24 * 60 * 60 // 5 days

/**
 * Donation policies and needs lists. The plan calls for 24-72h on policies and
 * 12-48h on needs; 36h sits inside both windows and keeps a single record.
 */
const RESEARCH_TTL_SECONDS = 36 * 60 * 60 // 36 hours

/** Normalizes "10001", " 10001 " and "New York, NY" into stable key parts. */
export function locationKey(location: string): string {
  return location
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
}

export function orgSlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
}

interface CachedResearch {
  org: ResearchedOrg
  researchedAt: string
}

export class ResearchCache {
  constructor(private readonly kv: KVNamespace | undefined) {}

  private get enabled(): boolean {
    return Boolean(this.kv)
  }

  async getDiscovery(location: string): Promise<DiscoveredOrg[] | null> {
    if (!this.enabled) return null
    return await this.kv!.get<DiscoveredOrg[]>(`loc:${locationKey(location)}:orgs`, 'json')
  }

  async putDiscovery(location: string, orgs: DiscoveredOrg[]): Promise<void> {
    if (!this.enabled) return
    await this.kv!.put(`loc:${locationKey(location)}:orgs`, JSON.stringify(orgs), {
      expirationTtl: DISCOVERY_TTL_SECONDS,
    })
  }

  async getResearch(name: string): Promise<CachedResearch | null> {
    if (!this.enabled) return null
    return await this.kv!.get<CachedResearch>(`org:${orgSlug(name)}:research`, 'json')
  }

  async putResearch(org: ResearchedOrg, researchedAt: string): Promise<void> {
    if (!this.enabled) return
    await this.kv!.put(
      `org:${orgSlug(org.name)}:research`,
      JSON.stringify({ org, researchedAt } satisfies CachedResearch),
      { expirationTtl: RESEARCH_TTL_SECONDS },
    )
  }
}
