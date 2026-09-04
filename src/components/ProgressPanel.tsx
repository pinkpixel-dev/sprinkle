import { Check, LoaderCircle } from 'lucide-react'
import type { ProgressStage } from '../../shared/types'
import type { ProgressState } from '../lib/useSearch'

const STAGES: { id: ProgressStage; label: string }[] = [
  { id: 'parsing', label: 'Reading your list' },
  { id: 'discovering', label: 'Finding nearby organizations' },
  { id: 'researching', label: 'Checking what they accept' },
  { id: 'matching', label: 'Matching your items' },
]

const ORDER: ProgressStage[] = ['parsing', 'discovering', 'researching', 'matching', 'done']

export function ProgressPanel({ progress }: { progress: ProgressState }) {
  const current = ORDER.indexOf(progress.stage)

  return (
    <section aria-live="polite" aria-busy="true" className="card p-5 sm:p-6">
      <h2 className="font-display text-lg font-semibold">Sprinkle is looking around</h2>
      <p className="mt-1 text-sm text-ink-soft">
        Real research takes a while. Expect somewhere around a minute and a half.
      </p>

      <ol className="mt-5 space-y-3">
        {STAGES.map((stage, index) => {
          const done = index < current
          const active = index === current
          return (
            <li key={stage.id} className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className={`flex size-6 shrink-0 items-center justify-center rounded-full border ${
                  done
                    ? 'border-leaf/30 bg-leaf-wash text-leaf'
                    : active
                      ? 'border-coral/35 bg-coral-wash text-coral-deep'
                      : 'border-edge bg-cream text-ink-faint'
                }`}
              >
                {done ? (
                  <Check className="size-3.5" />
                ) : active ? (
                  <LoaderCircle className="size-3.5 animate-spin" />
                ) : (
                  <span className="size-1.5 rounded-full bg-current" />
                )}
              </span>
              <span className={`text-sm ${active ? 'font-semibold text-ink' : done ? 'text-ink-soft' : 'text-ink-faint'}`}>
                {stage.label}
                {active && stage.id === 'researching' && progress.orgTotal > 0 && (
                  <span className="text-ink-faint">
                    {' '}
                    ({progress.orgDone} of {progress.orgTotal})
                  </span>
                )}
              </span>
            </li>
          )
        })}
      </ol>

      {progress.items.length > 0 && (
        <div className="mt-5 border-t border-edge pt-4">
          <h3 className="text-xs font-bold tracking-wider text-ink-faint uppercase">
            Items Sprinkle picked up
          </h3>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {progress.items.map((item) => (
              <li
                key={item.id}
                className="rounded-full border border-edge bg-cream px-2.5 py-1 text-xs text-ink-soft"
              >
                {item.quantity ? `${item.quantity} ` : ''}
                {item.name}
              </li>
            ))}
          </ul>
        </div>
      )}

      {progress.orgNames.length > 0 && (
        <div className="mt-4 border-t border-edge pt-4">
          <h3 className="text-xs font-bold tracking-wider text-ink-faint uppercase">
            Looking into
          </h3>
          <ul className="mt-2 space-y-1 text-sm text-ink-soft">
            {progress.orgNames.map((name, index) => (
              <li key={name} className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className={`size-1.5 shrink-0 rounded-full ${
                    index < progress.orgDone ? 'bg-leaf' : 'bg-edge'
                  }`}
                />
                {name}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
