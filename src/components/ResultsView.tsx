import { useMemo, useState } from 'react'
import { Database, RotateCw, TriangleAlert } from 'lucide-react'
import type { SearchResult } from '../../shared/types'
import { OrgCard } from './OrgCard'

interface Props {
  result: SearchResult
  onRefresh: () => void
  refreshing: boolean
}

export function ResultsView({ result, onRefresh, refreshing }: Props) {
  const [typeFilter, setTypeFilter] = useState<string>('all')

  const types = useMemo(() => {
    const counts = new Map<string, number>()
    for (const org of result.organizations) {
      counts.set(org.type, (counts.get(org.type) ?? 0) + 1)
    }
    return [...counts].sort((a, b) => b[1] - a[1])
  }, [result.organizations])

  const visible = useMemo(
    () =>
      typeFilter === 'all'
        ? result.organizations
        : result.organizations.filter((org) => org.type === typeFilter),
    [result.organizations, typeFilter],
  )

  return (
    <section className="space-y-5">
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <div>
          <h2 className="font-display text-2xl font-semibold">
            {result.organizations.length} place{result.organizations.length === 1 ? '' : 's'} near{' '}
            {result.location}
          </h2>
          <p className="mt-1 text-sm text-ink-soft">
            Sorted by how well your items line up with what each one currently needs.
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          className="inline-flex items-center gap-1.5 rounded-lg border border-edge bg-paper px-3 py-2 text-sm font-semibold text-ink-soft transition-colors hover:bg-sand disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RotateCw aria-hidden="true" className={`size-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          Research again
        </button>
      </header>

      {result.fullyCached && (
        <p className="flex items-start gap-2 rounded-xl border border-edge bg-sand/60 px-4 py-3 text-sm text-ink-soft">
          <Database aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>
            These results came from Sprinkle’s recent research for this area, so they loaded fast
            and cost nothing extra. Use <strong className="font-semibold">Research again</strong> for
            a fresh pass.
          </span>
        </p>
      )}

      {result.warnings?.map((warning) => (
        <p
          key={warning}
          className="flex items-start gap-2 rounded-xl border border-blush/40 bg-blush-wash px-4 py-3 text-sm text-ink"
        >
          <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-coral-deep" />
          <span>{warning}</span>
        </p>
      ))}

      {types.length > 1 && (
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by organization type">
          <button
            type="button"
            onClick={() => setTypeFilter('all')}
            aria-pressed={typeFilter === 'all'}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
              typeFilter === 'all'
                ? 'border-coral bg-coral text-white'
                : 'border-edge bg-paper text-ink-soft hover:bg-sand'
            }`}
          >
            All {result.organizations.length}
          </button>
          {types.map(([type, count]) => (
            <button
              key={type}
              type="button"
              onClick={() => setTypeFilter(type)}
              aria-pressed={typeFilter === type}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${
                typeFilter === type
                  ? 'border-coral bg-coral text-white'
                  : 'border-edge bg-paper text-ink-soft hover:bg-sand'
              }`}
            >
              {type} {count}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-4">
        {visible.map((org) => (
          <OrgCard key={org.id} org={org} />
        ))}
      </div>

      <p className="text-xs leading-relaxed text-ink-faint">
        Sprinkle reads public web pages and can be wrong or out of date. Anything marked{' '}
        <strong className="font-semibold">Call first</strong> or{' '}
        <strong className="font-semibold">Unknown</strong> is worth a phone call before you load up
        the car. Researched {new Date(result.searchedAt).toLocaleString()}.
      </p>
    </section>
  )
}
