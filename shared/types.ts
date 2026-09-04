/**
 * The API contract shared by the Cloudflare Worker and the React frontend.
 * Both sides import from here so a change to the shape breaks the build
 * instead of breaking at runtime.
 */

export type ItemCategory =
  | 'clothing'
  | 'food'
  | 'hygiene'
  | 'household'
  | 'furniture'
  | 'electronics'
  | 'books'
  | 'toys'
  | 'baby'
  | 'school'
  | 'pet'
  | 'medical'
  | 'other'

export type ItemCondition = 'new' | 'unopened' | 'gently used' | 'used' | 'damaged' | 'unknown'

export interface DonationItem {
  /** Stable id assigned server-side so the UI can key on it. */
  id: string
  name: string
  category: ItemCategory
  condition: ItemCondition
  quantity?: number
  /** Set when the model was not confident about the category. */
  needsReview?: boolean
}

export type VerificationStatus = 'confirmed' | 'likely' | 'call-first' | 'unknown'

export type MatchTier = 'best' | 'great' | 'possible' | 'call-first'

export type OrgType =
  | 'food pantry'
  | 'homeless shelter'
  | 'domestic violence support'
  | 'clothing closet'
  | 'family resource center'
  | 'refugee & immigrant support'
  | 'school program'
  | 'animal shelter'
  | 'senior support'
  | 'veterans organization'
  | 'community center'
  | 'mutual aid'
  | 'faith-based assistance'
  | 'nonprofit thrift store'
  | 'furniture bank'
  | 'technology reuse'
  | 'other'

export interface Source {
  title: string
  url: string
  /** What this source was used for, e.g. "donation page" or "current needs list". */
  kind?: string
}

export interface ItemMatch {
  /** Matches DonationItem.id. */
  itemId: string
  itemName: string
  accepted: boolean
  /** Present when the organization is actively asking for this item. */
  currentlyNeeded?: boolean
  /** Short reason, e.g. "must be unopened" or "no used electronics". */
  note?: string
}

export interface Organization {
  id: string
  name: string
  type: OrgType
  /** Human-readable, e.g. "New York, NY". */
  location: string
  address?: string
  distanceMiles?: number
  phone?: string
  website?: string
  donationPageUrl?: string

  /** What this org accepts in general, in their own words where possible. */
  acceptedItems: string[]
  /** Things they explicitly will not take. */
  rejectedItems: string[]
  /** Current wish list / most-needed items, when one was found. */
  currentNeeds: string[]

  dropOffInstructions?: string
  dropOffHours?: string
  appointmentRequired?: boolean

  verification: VerificationStatus
  /** One sentence explaining the verification status in plain language. */
  verificationNote: string
  /** ISO timestamp of when this org's research was performed. */
  researchedAt: string
  /** True when this org came back from KV rather than a fresh Gemini call. */
  fromCache?: boolean

  sources: Source[]

  // Filled in by the matching step, not by research.
  matches: ItemMatch[]
  matchTier: MatchTier
  matchScore: number
  /** One or two sentences on why this org is a good place for these items. */
  matchSummary: string
}

export interface SearchResult {
  location: string
  items: DonationItem[]
  organizations: Organization[]
  searchedAt: string
  /** True when every organization in the result came from cache. */
  fullyCached: boolean
  /** Present when research finished but something was degraded. */
  warnings?: string[]
}

export interface SearchRequest {
  location: string
  donationText: string
  /** Set by the "research again" button to skip the cache for this location. */
  refresh?: boolean
}

/** Stages streamed back to the UI over SSE while a search runs. */
export type ProgressStage =
  | 'parsing'
  | 'discovering'
  | 'researching'
  | 'matching'
  | 'done'

export type StreamEvent =
  | { type: 'progress'; stage: ProgressStage; message: string; detail?: string }
  | { type: 'items'; items: DonationItem[] }
  | { type: 'orgs-found'; count: number; names: string[] }
  | { type: 'org-researched'; name: string; index: number; total: number; fromCache: boolean }
  | { type: 'result'; result: SearchResult }
  | { type: 'error'; message: string; retryAfterSeconds?: number }

export const MAX_DONATION_TEXT = 1200
export const MAX_LOCATION_TEXT = 80
