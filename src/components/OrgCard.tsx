import { useId, useState } from 'react'
import {
  Check,
  ChevronDown,
  Clock,
  ExternalLink,
  MapPin,
  Phone,
  Sparkles,
  X,
} from 'lucide-react'
import type { Organization } from '../../shared/types'
import { MatchTierBadge, VerificationBadge } from './Badges'

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const hours = Math.floor(diffMs / 3_600_000)
  if (hours < 1) return 'just now'
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.floor(hours / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

function directionsUrl(org: Organization): string {
  const query = encodeURIComponent(org.address ? `${org.name}, ${org.address}` : `${org.name}, ${org.location}`)
  return `https://www.google.com/maps/search/?api=1&query=${query}`
}

export function OrgCard({ org }: { org: Organization }) {
  const [showSources, setShowSources] = useState(false)
  const sourcesId = useId()

  const accepted = org.matches.filter((m) => m.accepted)
  const declined = org.matches.filter((m) => !m.accepted && m.note)
  const link = org.donationPageUrl || org.website

  return (
    <article className="card overflow-hidden">
      <div className="flex flex-col gap-4 p-5 sm:p-6">
        <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div className="min-w-0">
            <h3 className="text-xl font-semibold text-balance">{org.name}</h3>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-faint">
              <span className="capitalize">{org.type}</span>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1">
                <MapPin aria-hidden="true" className="size-3.5" />
                {org.location}
              </span>
              {typeof org.distanceMiles === 'number' && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{org.distanceMiles.toFixed(1)} mi</span>
                </>
              )}
            </p>
          </div>
          <MatchTierBadge tier={org.matchTier} />
        </header>

        <p className="text-[0.95rem] leading-relaxed text-ink-soft">{org.matchSummary}</p>

        {accepted.length > 0 && (
          <section>
            <h4 className="text-xs font-bold tracking-wider text-ink-faint uppercase">
              You can donate
            </h4>
            <ul className="mt-2 flex flex-wrap gap-2">
              {accepted.map((match) => (
                <li
                  key={match.itemId}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm ${
                    match.currentlyNeeded
                      ? 'border-coral/35 bg-coral-wash font-semibold text-coral-deep'
                      : 'border-edge bg-cream text-ink'
                  }`}
                >
                  {match.currentlyNeeded ? (
                    <Sparkles aria-hidden="true" className="size-3.5" />
                  ) : (
                    <Check aria-hidden="true" className="size-3.5 text-leaf" />
                  )}
                  {match.itemName}
                  {match.currentlyNeeded && <span className="sr-only">, on their current needs list</span>}
                  {match.note && (
                    <span className="text-xs font-normal text-ink-faint">({match.note})</span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {org.currentNeeds.length > 0 && (
          <section>
            <h4 className="text-xs font-bold tracking-wider text-ink-faint uppercase">
              On their current needs list
            </h4>
            <p className="mt-1.5 text-sm text-ink-soft">{org.currentNeeds.join(' · ')}</p>
          </section>
        )}

        {declined.length > 0 && (
          <section>
            <h4 className="text-xs font-bold tracking-wider text-ink-faint uppercase">
              Leave at home
            </h4>
            <ul className="mt-1.5 space-y-1">
              {declined.map((match) => (
                <li key={match.itemId} className="flex items-start gap-1.5 text-sm text-ink-faint">
                  <X aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
                  <span>
                    {match.itemName}
                    {match.note && <span className="text-ink-faint"> · {match.note}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {(org.dropOffInstructions || org.dropOffHours || org.appointmentRequired) && (
          <section className="border-t border-edge pt-4 text-sm text-ink-soft">
            {org.dropOffInstructions && <p>{org.dropOffInstructions}</p>}
            {org.dropOffHours && (
              <p className="mt-1.5 inline-flex items-center gap-1.5">
                <Clock aria-hidden="true" className="size-3.5 shrink-0" />
                {org.dropOffHours}
              </p>
            )}
            {org.appointmentRequired && (
              <p className="mt-1.5 font-medium text-coral-deep">Appointment required.</p>
            )}
          </section>
        )}
      </div>

      <footer className="border-t border-edge bg-cream/60 px-5 py-4 sm:px-6">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <VerificationBadge status={org.verification} />
          <p className="min-w-0 flex-1 text-xs text-ink-faint">
            {org.verificationNote} Checked {relativeTime(org.researchedAt)}
            {org.fromCache && ' · from Sprinkle’s cache'}.
          </p>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {link && (
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-coral px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-coral-deep active:bg-coral-deep"
            >
              Donation info
              <ExternalLink aria-hidden="true" className="size-3.5" />
              <span className="sr-only">for {org.name}, opens in a new tab</span>
            </a>
          )}
          <a
            href={directionsUrl(org)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-edge bg-paper px-3.5 py-2 text-sm font-semibold text-ink transition-colors hover:bg-sand"
          >
            Directions
            <span className="sr-only">to {org.name}, opens in a new tab</span>
          </a>
          {org.phone && (
            <a
              href={`tel:${org.phone.replace(/[^\d+]/g, '')}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-edge bg-paper px-3.5 py-2 text-sm font-semibold text-ink transition-colors hover:bg-sand"
            >
              <Phone aria-hidden="true" className="size-3.5" />
              {org.phone}
            </a>
          )}
          {org.sources.length > 0 && (
            <button
              type="button"
              onClick={() => setShowSources((v) => !v)}
              aria-expanded={showSources}
              aria-controls={sourcesId}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-2 text-sm font-medium text-ink-soft transition-colors hover:text-ink"
            >
              {org.sources.length} source{org.sources.length === 1 ? '' : 's'}
              <ChevronDown
                aria-hidden="true"
                className={`size-4 transition-transform ${showSources ? 'rotate-180' : ''}`}
              />
            </button>
          )}
        </div>

        <ul id={sourcesId} hidden={!showSources} className="mt-3 space-y-1.5 border-t border-edge pt-3">
          {org.sources.map((source) => (
            <li key={source.url}>
              <a
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-baseline gap-1.5 text-sm text-coral-deep underline decoration-coral/40 underline-offset-2 hover:decoration-coral-deep"
              >
                {source.title}
                {source.kind && <span className="text-xs text-ink-faint">({source.kind})</span>}
              </a>
            </li>
          ))}
        </ul>
      </footer>
    </article>
  )
}
