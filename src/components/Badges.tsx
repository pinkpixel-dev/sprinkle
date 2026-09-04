import { BadgeCheck, CircleHelp, PhoneCall, ShieldQuestion } from 'lucide-react'
import type { MatchTier, VerificationStatus } from '../../shared/types'

const VERIFICATION_LABEL: Record<VerificationStatus, string> = {
  confirmed: 'Confirmed',
  likely: 'Likely',
  'call-first': 'Call first',
  unknown: 'Unknown',
}

const VERIFICATION_ICON = {
  confirmed: BadgeCheck,
  likely: ShieldQuestion,
  'call-first': PhoneCall,
  unknown: CircleHelp,
} as const

const VERIFICATION_STYLE: Record<VerificationStatus, string> = {
  confirmed: 'bg-leaf-wash text-leaf border-leaf/25',
  likely: 'bg-kraft-wash text-ink-soft border-kraft/40',
  'call-first': 'bg-blush-wash text-coral-deep border-blush/40',
  unknown: 'bg-sand text-ink-faint border-edge',
}

export function VerificationBadge({ status }: { status: VerificationStatus }) {
  const Icon = VERIFICATION_ICON[status]
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${VERIFICATION_STYLE[status]}`}
    >
      <Icon aria-hidden="true" className="size-3.5 shrink-0" />
      {VERIFICATION_LABEL[status]}
    </span>
  )
}

const TIER_LABEL: Record<MatchTier, string> = {
  best: 'Best match',
  great: 'Great match',
  possible: 'Possible match',
  'call-first': 'Call first',
}

const TIER_STYLE: Record<MatchTier, string> = {
  best: 'bg-coral text-white',
  great: 'bg-coral-wash text-coral-deep',
  possible: 'bg-sand text-ink-soft',
  'call-first': 'bg-paper text-ink-faint border border-edge',
}

export function MatchTierBadge({ tier }: { tier: MatchTier }) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-bold tracking-wide uppercase ${TIER_STYLE[tier]}`}
    >
      {TIER_LABEL[tier]}
    </span>
  )
}
