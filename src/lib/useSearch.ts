import { useCallback, useRef, useState } from 'react'
import type {
  DonationItem,
  ProgressStage,
  SearchResult,
  StreamEvent,
} from '../../shared/types'

export interface ProgressState {
  stage: ProgressStage
  message: string
  /** Names of candidate organizations, as soon as discovery finds them. */
  orgNames: string[]
  /** Organizations finished so far, out of `orgTotal`. */
  orgDone: number
  orgTotal: number
  /** Items, streamed in before research starts. */
  items: DonationItem[]
}

const EMPTY_PROGRESS: ProgressState = {
  stage: 'parsing',
  message: 'Reading your list',
  orgNames: [],
  orgDone: 0,
  orgTotal: 0,
  items: [],
}

export interface SearchState {
  status: 'idle' | 'running' | 'done' | 'error'
  progress: ProgressState
  result: SearchResult | null
  error: string | null
}

/**
 * Drives one search over the Worker's SSE endpoint.
 *
 * EventSource cannot POST, so this reads the response body itself and splits
 * on the blank-line frame separator.
 */
export function useSearch() {
  const [state, setState] = useState<SearchState>({
    status: 'idle',
    progress: EMPTY_PROGRESS,
    result: null,
    error: null,
  })
  const abortRef = useRef<AbortController | null>(null)

  const cancel = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setState((s) => (s.status === 'running' ? { ...s, status: 'idle' } : s))
  }, [])

  const reset = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setState({ status: 'idle', progress: EMPTY_PROGRESS, result: null, error: null })
  }, [])

  const search = useCallback(
    async (location: string, donationText: string, refresh = false) => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      setState({ status: 'running', progress: EMPTY_PROGRESS, result: null, error: null })

      const applyEvent = (event: StreamEvent) => {
        setState((prev) => {
          switch (event.type) {
            case 'progress':
              return {
                ...prev,
                progress: { ...prev.progress, stage: event.stage, message: event.message },
              }
            case 'items':
              return { ...prev, progress: { ...prev.progress, items: event.items } }
            case 'orgs-found':
              return {
                ...prev,
                progress: { ...prev.progress, orgNames: event.names, orgTotal: event.count },
              }
            case 'org-researched':
              return {
                ...prev,
                progress: { ...prev.progress, orgDone: event.index, orgTotal: event.total },
              }
            case 'result':
              return { ...prev, status: 'done', result: event.result }
            case 'error':
              return { ...prev, status: 'error', error: event.message }
          }
        })
      }

      try {
        const res = await fetch('/api/find-donation-matches', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ location, donationText, refresh }),
          signal: controller.signal,
        })

        if (!res.ok || !res.body) {
          const raw = await res.text().catch(() => '')
          let message: string
          try {
            // The API always answers errors as JSON with an `error` field.
            message = (JSON.parse(raw) as { error?: string }).error ?? ''
          } catch {
            message = ''
          }
          if (!message) {
            // A non-JSON body means the request never reached the Worker.
            // In dev that is almost always the Vite proxy with nothing on 8787.
            console.error(`Sprinkle API returned ${res.status}:`, raw.slice(0, 500))
            message = `The Sprinkle API did not respond (HTTP ${res.status}). If you are running locally, check that the Worker is running with "npm run dev:worker".`
          }
          setState((prev) => ({ ...prev, status: 'error', error: message }))
          return
        }

        const reader = res.body.pipeThrough(new TextDecoderStream()).getReader()
        let buffer = ''

        for (;;) {
          const { value, done } = await reader.read()
          if (done) break
          buffer += value

          let boundary = buffer.indexOf('\n\n')
          while (boundary !== -1) {
            const frame = buffer.slice(0, boundary)
            buffer = buffer.slice(boundary + 2)
            const payload = frame
              .split('\n')
              .filter((line) => line.startsWith('data:'))
              .map((line) => line.slice(5).trim())
              .join('')
            if (payload) {
              try {
                applyEvent(JSON.parse(payload) as StreamEvent)
              } catch {
                // A malformed frame is not worth killing the whole search over.
              }
            }
            boundary = buffer.indexOf('\n\n')
          }
        }

        setState((prev) =>
          prev.status === 'running'
            ? { ...prev, status: 'error', error: 'The search ended before it finished.' }
            : prev,
        )
      } catch (err) {
        if ((err as Error).name === 'AbortError') return
        setState((prev) => ({
          ...prev,
          status: 'error',
          error: 'Sprinkle lost its connection. Try that again.',
        }))
      } finally {
        if (abortRef.current === controller) abortRef.current = null
      }
    },
    [],
  )

  return { ...state, search, cancel, reset }
}
