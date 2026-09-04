import { useCallback, useRef } from 'react'
import { Heart } from 'lucide-react'
import { SearchForm } from './components/SearchForm'
import { ProgressPanel } from './components/ProgressPanel'
import { ResultsView } from './components/ResultsView'
import { useSearch } from './lib/useSearch'
import { APP_VERSION, TAGLINE } from './lib/app-info'

export default function App() {
  const { status, progress, result, error, search, cancel } = useSearch()
  // Kept so "Research again" can replay the same query with the cache skipped.
  const lastQuery = useRef<{ location: string; donationText: string } | null>(null)

  const handleSearch = useCallback(
    (location: string, donationText: string) => {
      lastQuery.current = { location, donationText }
      void search(location, donationText)
    },
    [search],
  )

  const handleRefresh = useCallback(() => {
    const query = lastQuery.current
    if (!query) return
    void search(query.location, query.donationText, true)
  }, [search])

  const running = status === 'running'

  return (
    <div className="mx-auto flex min-h-dvh max-w-3xl flex-col px-4 py-8 sm:px-6 sm:py-12">
      <header className="flex items-center gap-3.5">
        <img
          src="/logo.png"
          alt=""
          width={56}
          height={56}
          className="size-12 shrink-0 sm:size-14"
        />
        <div>
          <h1 className="font-display text-3xl font-bold sm:text-4xl">Sprinkle</h1>
          <p className="text-sm text-ink-soft sm:text-base">{TAGLINE}</p>
        </div>
      </header>

      <main className="mt-8 flex-1 space-y-6">
        <SearchForm onSearch={handleSearch} running={running} onCancel={cancel} />

        {running && <ProgressPanel progress={progress} />}

        {status === 'error' && error && (
          <p role="alert" className="card border-blush/50 bg-blush-wash p-5 text-ink">
            {error}
          </p>
        )}

        {status === 'done' && result && (
          <ResultsView result={result} onRefresh={handleRefresh} refreshing={false} />
        )}

        {status === 'idle' && (
          <section className="card p-5 sm:p-6">
            <h2 className="font-display text-lg font-semibold">How this works</h2>
            <ol className="mt-3 space-y-2.5 text-sm leading-relaxed text-ink-soft">
              <li>
                <strong className="font-semibold text-ink">1.</strong> Sprinkle reads your list and
                sorts it into real donation categories.
              </li>
              <li>
                <strong className="font-semibold text-ink">2.</strong> It searches for local
                organizations that take those kinds of things.
              </li>
              <li>
                <strong className="font-semibold text-ink">3.</strong> It reads their donation pages
                for what they accept, what they refuse, and what they are asking for right now.
              </li>
              <li>
                <strong className="font-semibold text-ink">4.</strong> You get the matches, each one
                labeled with how well Sprinkle could confirm it, plus the links it used.
              </li>
            </ol>
            <p className="mt-4 border-t border-edge pt-4 text-sm text-ink-soft">
              No account, no email, no home address. Your list is used for this one search and is not
              stored.
            </p>
          </section>
        )}
      </main>

      <footer className="mt-10 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-edge pt-5 text-xs text-ink-faint">
        <p className="inline-flex items-center gap-1.5">
          Made with
          <Heart aria-hidden="true" className="size-3.5 fill-blush text-blush" />
          <span className="sr-only">love</span>
          by{' '}
          <a
            href="https://pinkpixel.dev"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-ink-soft underline decoration-edge underline-offset-2 hover:text-coral-deep"
          >
            Pink Pixel
          </a>
        </p>
        <p>v{APP_VERSION} · Researched with Gemini and Google Search</p>
      </footer>
    </div>
  )
}
