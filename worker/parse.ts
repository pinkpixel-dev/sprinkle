import { generateJson } from './gemini'
import { parseSchema } from './schemas'
import type { DonationItem, ItemCategory, ItemCondition } from '../shared/types'

const SYSTEM = `You turn a casual description of things someone wants to donate into a clean list of items.

Rules:
- One entry per distinct kind of item. "Some kids clothes and two winter coats" is two entries.
- Keep the user's own words for the name where they are clear. Do not invent brand names or details.
- Only set quantity when the user actually gave a number.
- Condition: use "unopened" for sealed consumables, "new" for unused items with tags, "gently used" when the user says good condition, "used" as the general default for secondhand items, and "unknown" when there is no signal at all.
- Set needsReview to true when the item could sensibly land in more than one category, or when you are unsure what the item even is.
- Ignore anything that is not a physical donatable item. Do not invent items the user did not mention.`

interface ParseResponse {
  items: {
    name: string
    category: ItemCategory
    condition: ItemCondition
    quantity?: number
    needsReview?: boolean
  }[]
}

/** Turns freeform donation text into structured items. */
export async function parseDonation(
  apiKey: string,
  model: string,
  donationText: string,
): Promise<DonationItem[]> {
  const { data } = await generateJson<ParseResponse>({
    apiKey,
    model,
    systemInstruction: SYSTEM,
    input: `Here is what the person has to donate:\n\n${donationText}`,
    schema: parseSchema,
    thinkingLevel: 'low',
    timeoutMs: 30_000,
  })

  return (data.items ?? [])
    .filter((item) => item?.name?.trim())
    .slice(0, 25)
    .map((item, i) => ({
      id: `item-${i}`,
      name: item.name.trim(),
      category: item.category ?? 'other',
      condition: item.condition ?? 'unknown',
      ...(typeof item.quantity === 'number' && item.quantity > 0
        ? { quantity: item.quantity }
        : {}),
      ...(item.needsReview ? { needsReview: true } : {}),
    }))
}
