/**
 * JSON Schemas handed to Gemini via `response_format`.
 *
 * These are deliberately strict. The whole point of Sprinkle is that a result
 * carries its own evidence, so anything the model cannot support with a source
 * should come back as an empty array rather than a confident guess.
 */

const ITEM_CATEGORIES = [
  'clothing', 'food', 'hygiene', 'household', 'furniture', 'electronics',
  'books', 'toys', 'baby', 'school', 'pet', 'medical', 'other',
] as const

const ITEM_CONDITIONS = [
  'new', 'unopened', 'gently used', 'used', 'damaged', 'unknown',
] as const

const ORG_TYPES = [
  'food pantry', 'homeless shelter', 'domestic violence support', 'clothing closet',
  'family resource center', 'refugee & immigrant support', 'school program',
  'animal shelter', 'senior support', 'veterans organization', 'community center',
  'mutual aid', 'faith-based assistance', 'nonprofit thrift store', 'furniture bank',
  'technology reuse', 'other',
] as const

export const parseSchema = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Short plain name, e.g. "winter coats"' },
          category: { type: 'string', enum: [...ITEM_CATEGORIES] },
          condition: { type: 'string', enum: [...ITEM_CONDITIONS] },
          quantity: { type: 'integer', description: 'Omit when the user did not say' },
          needsReview: {
            type: 'boolean',
            description: 'True when you were not confident about the category',
          },
        },
        required: ['name', 'category', 'condition'],
      },
    },
  },
  required: ['items'],
} as const

export const discoverSchema = {
  type: 'object',
  properties: {
    organizations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          type: { type: 'string', enum: [...ORG_TYPES] },
          location: { type: 'string', description: 'City and state, e.g. "New York, NY"' },
          address: { type: 'string' },
          website: { type: 'string', description: 'Official site URL if you found one' },
          whyRelevant: {
            type: 'string',
            description: 'One sentence on why this org may want the donated items',
          },
        },
        required: ['name', 'type', 'location', 'whyRelevant'],
      },
    },
  },
  required: ['organizations'],
} as const

const sourceSchema = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    url: { type: 'string' },
    kind: {
      type: 'string',
      description: 'What it documents, e.g. "donation page" or "current needs list"',
    },
  },
  required: ['title', 'url'],
} as const

const researchedOrgSchema = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    type: { type: 'string', enum: [...ORG_TYPES] },
    location: { type: 'string' },
    address: { type: 'string' },
    phone: { type: 'string' },
    website: { type: 'string' },
    donationPageUrl: { type: 'string' },
    acceptedItems: {
      type: 'array',
      items: { type: 'string' },
      description: 'Item types the org accepts, in their own wording where possible',
    },
    rejectedItems: {
      type: 'array',
      items: { type: 'string' },
      description: 'Item types the org explicitly says it does not take',
    },
    currentNeeds: {
      type: 'array',
      items: { type: 'string' },
      description: 'Current wish list or most-needed items. Empty array if none was found.',
    },
    dropOffInstructions: { type: 'string' },
    dropOffHours: { type: 'string' },
    appointmentRequired: { type: 'boolean' },
    verification: {
      type: 'string',
      enum: ['confirmed', 'likely', 'call-first', 'unknown'],
    },
    verificationNote: {
      type: 'string',
      description: 'One plain sentence explaining the verification status',
    },
    sources: { type: 'array', items: sourceSchema },
  },
  required: ['name', 'type', 'location', 'acceptedItems', 'rejectedItems', 'currentNeeds', 'verification', 'verificationNote', 'sources'],
} as const

export const researchSchema = {
  type: 'object',
  properties: {
    organizations: { type: 'array', items: researchedOrgSchema },
  },
  required: ['organizations'],
} as const

export const matchSchema = {
  type: 'object',
  properties: {
    matches: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          orgName: { type: 'string' },
          summary: {
            type: 'string',
            description: 'One or two sentences on why these items suit this org',
          },
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                itemName: { type: 'string' },
                accepted: { type: 'boolean' },
                currentlyNeeded: { type: 'boolean' },
                note: {
                  type: 'string',
                  description: 'Short condition or restriction, e.g. "must be unopened"',
                },
              },
              required: ['itemName', 'accepted'],
            },
          },
        },
        required: ['orgName', 'summary', 'items'],
      },
    },
  },
  required: ['matches'],
} as const
