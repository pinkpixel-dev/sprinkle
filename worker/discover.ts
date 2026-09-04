import { generateJson } from './gemini'
import { discoverSchema } from './schemas'
import type { DonationItem, OrgType } from '../shared/types'

const SYSTEM = `You find real local organizations that accept donated household goods.

Use Google Search. Do not list organizations from memory. Every organization you return must have appeared in a search result for this specific area.

What matters:
- Real, currently operating organizations that serve the area given.
- Places that plausibly want the specific items described, not a generic charity list.
- A mix of organization types when the donation covers several categories. Food goes to pantries, coats and clothes go to shelters and clothing closets, electronics go to reuse programs, and so on.
- Prefer organizations that take donations directly from the public.

Skip:
- National donation portals, directory sites, and aggregators that are not themselves a local drop-off.
- For-profit resale businesses.
- Organizations you cannot tie to a real search result.

If you can only find a few good organizations, return only those. A short honest list beats a padded one.`

export interface DiscoveredOrg {
  name: string
  type: OrgType
  location: string
  address?: string
  website?: string
  whyRelevant: string
}

interface DiscoverResponse {
  organizations: DiscoveredOrg[]
}

function describeItems(items: DonationItem[]): string {
  const byCategory = new Map<string, string[]>()
  for (const item of items) {
    const list = byCategory.get(item.category) ?? []
    list.push(item.quantity ? `${item.quantity} ${item.name}` : item.name)
    byCategory.set(item.category, list)
  }
  return [...byCategory]
    .map(([category, names]) => `- ${category}: ${names.join(', ')}`)
    .join('\n')
}

/** Stage one: search for candidate organizations near the given location. */
export async function discoverOrganizations(
  apiKey: string,
  model: string,
  location: string,
  items: DonationItem[],
  limit: number,
): Promise<DiscoveredOrg[]> {
  const input = `Location: ${location}

Someone in this area has these items to donate:
${describeItems(items)}

Search for up to ${limit} local organizations near this location that could use these items. Run several searches covering the different item categories. Return the organizations you can actually find evidence for.`

  const { data } = await generateJson<DiscoverResponse>({
    apiKey,
    model,
    systemInstruction: SYSTEM,
    input,
    tools: [{ type: 'google_search' }],
    schema: discoverSchema,
    timeoutMs: 90_000,
  })

  const seen = new Set<string>()
  return (data.organizations ?? [])
    .filter((org) => {
      const key = org?.name?.trim().toLowerCase()
      if (!key || seen.has(key)) return false
      seen.add(key)
      return true
    })
    .slice(0, limit)
}
