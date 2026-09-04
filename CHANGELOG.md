# Changelog

All notable changes to Sprinkle are recorded here.

## 0.1.0 - September 4, 2026

First working version, built for the DEV Weekend Challenge: Generosity Edition.

### ✨ Features

- Freeform donation input, parsed into structured items with category and condition by `gemini-3.5-flash-lite`
- Organization discovery near a ZIP code or city using `gemini-3.7-flash` with Google Search grounding
- Research stage that reads organization donation pages with Google Search plus the URL context tool, extracting accepted items, refused items, drop-off details, hours, and current needs lists
- Item matching with local scoring and ranking, presented as Best match, Great match, Possible match, and Call first
- Verification labels on every result: Confirmed, Likely, Call first, Unknown, each with a plain-language reason
- Source links behind every researched claim
- Live search progress streamed over server-sent events
- Filter results by organization type
- Cached-result indicator, plus a "Research again" button that skips the cache

### 🧱 Infrastructure

- Single Cloudflare Worker serving both the API and the built React app
- KV cache: discovery per area for 5 days, research per organization for 36 hours
- Rate limiting at one search per IP per 30 seconds
- Gemini calls sent with `store: false` so donation text is not retained
- Request validation and length limits on both input fields
- Per-call timeouts and a cap of 8 organizations researched per search

### 🎨 Design

- Warm cream and coral palette drawn from the Sprinkle mark
- Fraunces and Figtree type pairing
- Mobile-first layout, verified at 375px with no horizontal overflow
- Focus-visible rings, ARIA live regions on the progress panel, and reduced-motion support
