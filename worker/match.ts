import { generateJson } from './gemini'
import { matchSchema } from './schemas'
import type { ResearchedOrg } from './research'
import type { DonationItem, ItemMatch, MatchTier, Organization } from '../shared/types'

const SYSTEM = `You compare a person's donation items against what each organization accepts.

For every organization, go through the person's items one at a time:
- accepted: true only when the organization's accepted list, or its stated mission, clearly covers that item.
- currentlyNeeded: true only when the item appears on that organization's current needs list.
- note: a short restriction when one applies, like "unopened only", "no appointments needed", or "they specifically say no used electronics".

Be conservative. If an organization's information is thin, mark items as not accepted rather than guessing, and say so in the summary.

The summary is one or two plain sentences aimed at the person donating. No hype, no "amazing opportunity". Something like "They run a weekly food box program and their needs list currently asks for canned protein." If the information is thin, say that instead.`

interface MatchResponse {
  matches: {
    orgName: string
    summary: string
    items: { itemName: string; accepted: boolean; currentlyNeeded?: boolean; note?: string }[]
  }[]
}

const VERIFICATION_BONUS = {
  confirmed: 18,
  likely: 10,
  'call-first': 3,
  unknown: 0,
} as const

/** Turns the raw signals into a 0-100ish score. Users never see the number. */
function scoreOrg(org: ResearchedOrg, matches: ItemMatch[], totalItems: number): number {
  const acceptedCount = matches.filter((m) => m.accepted).length
  const neededCount = matches.filter((m) => m.accepted && m.currentlyNeeded).length
  const rejectedCount = matches.filter((m) => !m.accepted && m.note).length

  const coverage = totalItems > 0 ? acceptedCount / totalItems : 0

  const score =
    coverage * 40 +
    neededCount * 8 +
    VERIFICATION_BONUS[org.verification] -
    rejectedCount * 3

  return Math.max(0, Math.round(score))
}

function tierFor(org: ResearchedOrg, matches: ItemMatch[], score: number): MatchTier {
  const acceptedCount = matches.filter((m) => m.accepted).length
  if (acceptedCount === 0) return 'call-first'
  // Thin or contradictory information means "check before you drive over",
  // no matter how well the items line up on paper.
  if (org.verification === 'unknown' || org.verification === 'call-first') return 'call-first'
  if (score >= 45) return 'best'
  if (score >= 28) return 'great'
  return 'possible'
}

function fallbackMatches(items: DonationItem[]): ItemMatch[] {
  return items.map((item) => ({
    itemId: item.id,
    itemName: item.name,
    accepted: false,
  }))
}

function summarizeOrg(org: ResearchedOrg): string {
  const lines = [
    `${org.name} (${org.type}, ${org.location})`,
    `  Accepts: ${org.acceptedItems.join('; ') || 'not documented'}`,
    `  Does not accept: ${org.rejectedItems.join('; ') || 'nothing stated'}`,
    `  Current needs: ${org.currentNeeds.join('; ') || 'no current needs list found'}`,
    `  Verification: ${org.verification} - ${org.verificationNote}`,
  ]
  return lines.join('\n')
}

/**
 * Stage three: one ungrounded Gemini call matches every item against every
 * organization, then scoring and ranking happen locally so the ordering is
 * deterministic and explainable.
 */
export async function matchOrganizations(
  apiKey: string,
  model: string,
  items: DonationItem[],
  orgs: { research: ResearchedOrg; researchedAt: string; fromCache: boolean }[],
): Promise<Organization[]> {
  const itemList = items
    .map((item) => `- ${item.name} (${item.category}, ${item.condition}${item.quantity ? `, qty ${item.quantity}` : ''})`)
    .join('\n')

  const orgList = orgs.map((o) => summarizeOrg(o.research)).join('\n\n')

  let response: MatchResponse = { matches: [] }
  try {
    const { data } = await generateJson<MatchResponse>({
      apiKey,
      model,
      systemInstruction: SYSTEM,
      input: `The person has these items:\n${itemList}\n\nThe organizations:\n\n${orgList}`,
      schema: matchSchema,
      thinkingLevel: 'low',
      timeoutMs: 60_000,
    })
    response = data
  } catch {
    // Fall through with empty matches; every org becomes "call first".
  }

  const byName = new Map(
    (response.matches ?? []).map((m) => [m.orgName?.trim().toLowerCase(), m]),
  )

  const results: Organization[] = orgs.map((entry, index) => {
    const org = entry.research
    const raw = byName.get(org.name.trim().toLowerCase())

    const matches: ItemMatch[] = raw
      ? items.map((item) => {
          const found = raw.items?.find(
            (m) => m.itemName?.trim().toLowerCase() === item.name.trim().toLowerCase(),
          )
          return {
            itemId: item.id,
            itemName: item.name,
            accepted: Boolean(found?.accepted),
            ...(found?.currentlyNeeded ? { currentlyNeeded: true } : {}),
            ...(found?.note ? { note: found.note } : {}),
          }
        })
      : fallbackMatches(items)

    const score = scoreOrg(org, matches, items.length)

    return {
      id: `org-${index}`,
      ...org,
      researchedAt: entry.researchedAt,
      ...(entry.fromCache ? { fromCache: true } : {}),
      matches,
      matchScore: score,
      matchTier: tierFor(org, matches, score),
      matchSummary:
        raw?.summary?.trim() ||
        'Sprinkle could not confirm what this organization currently accepts. Worth a quick call.',
    }
  })

  return results.sort((a, b) => b.matchScore - a.matchScore)
}
