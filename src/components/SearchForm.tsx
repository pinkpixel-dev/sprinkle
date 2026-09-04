import { useState } from 'react'
import { LoaderCircle, Search } from 'lucide-react'
import { MAX_DONATION_TEXT, MAX_LOCATION_TEXT } from '../../shared/types'

const EXAMPLES = [
  'Two winter coats, kids clothes, and canned food',
  'Unopened shampoo, toothpaste, and a bag of towels',
  'An old Chromebook and a box of school supplies',
]

interface Props {
  onSearch: (location: string, donationText: string) => void
  running: boolean
  onCancel: () => void
}

export function SearchForm({ onSearch, running, onCancel }: Props) {
  const [donationText, setDonationText] = useState('')
  const [location, setLocation] = useState('')
  const [touched, setTouched] = useState(false)

  const itemsMissing = donationText.trim().length < 3
  const locationMissing = location.trim().length < 3
  const invalid = itemsMissing || locationMissing

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setTouched(true)
    if (invalid || running) return
    onSearch(location.trim(), donationText.trim())
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="card p-5 sm:p-7">
      <div>
        <label htmlFor="donation" className="block font-display text-2xl font-semibold sm:text-3xl">
          What do you have to give?
        </label>
        <p className="mt-1.5 text-sm text-ink-soft">
          Plain language is fine. List it the way you would tell a friend.
        </p>
        <textarea
          id="donation"
          name="donation"
          rows={4}
          value={donationText}
          maxLength={MAX_DONATION_TEXT}
          onChange={(e) => setDonationText(e.target.value)}
          placeholder="I have two winter coats, some kids clothes, canned food, unopened shampoo and toothpaste, and an older Chromebook."
          aria-describedby={touched && itemsMissing ? 'donation-error' : 'donation-count'}
          aria-invalid={touched && itemsMissing}
          className="mt-3 w-full resize-y rounded-xl border border-edge bg-cream px-4 py-3 text-base leading-relaxed text-ink placeholder:text-ink-faint/70 focus:border-coral focus:bg-paper"
        />
        <div className="mt-1.5 flex items-baseline justify-between gap-3">
          {touched && itemsMissing ? (
            <p id="donation-error" role="alert" className="text-sm font-medium text-coral-deep">
              Add at least one thing you want to donate.
            </p>
          ) : (
            <p id="donation-count" className="text-xs text-ink-faint">
              {donationText.length} / {MAX_DONATION_TEXT}
            </p>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {EXAMPLES.map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => setDonationText(example)}
            className="rounded-full border border-edge bg-cream px-3 py-1.5 text-left text-xs font-medium text-ink-soft transition-colors hover:border-coral/40 hover:bg-coral-wash hover:text-coral-deep"
          >
            {example}
          </button>
        ))}
      </div>

      <div className="mt-6 flex flex-col gap-4 border-t border-edge pt-5 sm:flex-row sm:items-end">
        <div className="sm:max-w-xs sm:flex-1">
          <label htmlFor="location" className="block text-sm font-semibold">
            Where are you?
          </label>
          <input
            id="location"
            name="location"
            type="text"
            inputMode="text"
            autoComplete="postal-code"
            value={location}
            maxLength={MAX_LOCATION_TEXT}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="10001 or New York, NY"
            aria-describedby={touched && locationMissing ? 'location-error' : 'location-hint'}
            aria-invalid={touched && locationMissing}
            className="mt-2 w-full rounded-xl border border-edge bg-cream px-4 py-3 text-base text-ink placeholder:text-ink-faint/70 focus:border-coral focus:bg-paper"
          />
          {touched && locationMissing ? (
            <p id="location-error" role="alert" className="mt-1.5 text-sm font-medium text-coral-deep">
              A ZIP code or city and state, please.
            </p>
          ) : (
            <p id="location-hint" className="mt-1.5 text-xs text-ink-faint">
              A ZIP code is enough. Sprinkle never asks for your address.
            </p>
          )}
        </div>

        <div className="flex gap-2 sm:ml-auto">
          {running && (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-xl border border-edge bg-paper px-4 py-3 text-base font-semibold text-ink-soft transition-colors hover:bg-sand"
            >
              Stop
            </button>
          )}
          <button
            type="submit"
            disabled={running}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-coral px-6 py-3 text-base font-semibold whitespace-nowrap text-white transition-colors hover:bg-coral-deep disabled:cursor-not-allowed disabled:bg-kraft"
          >
            {running ? (
              <>
                <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
                Searching
              </>
            ) : (
              <>
                <Search aria-hidden="true" className="size-4" />
                Find places
              </>
            )}
          </button>
        </div>
      </div>
    </form>
  )
}
