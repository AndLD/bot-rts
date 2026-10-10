[← Development plan index](../DEVELOPMENT-PLAN.md)

# Phase 7 — Presentation & engagement: landing, auth scene, achievements, notifications, Russian (40 SP)

Make the game attractive and sticky: the public face (landing page and auth page with a live ambient scene), the
achievements and realtime notification systems built on the game event bus (task 5.10), and the Russian translation.

| # | Task | SP |
| --- | --- | --- |
| 7.1 | Ambient scene: self-contained scripted simulation (bots moving, digging, shooting, repairing) rendered with the map renderer and animation system; pauses when hidden | 5 |
| 7.2 | Authentication page redesign: forms over the ambient scene, matching the landing page | 3 |
| 7.3 | Landing page as marketing routes of the Next.js app (route group `(marketing)`, static rendering): hero with the ambient scene, how it works, features, showcase, FAQ, links to docs/API, `next-intl` routes `/` and `/ru/`, Metadata API with Open Graph/Twitter cards, `hreflang`, canonical URLs, sitemap, robots, `VideoGame` structured data, static poster with lazy-loaded scene and reduced-motion fallback, Lighthouse CI gate (SEO ≥ 95, performance ≥ 90) | 8 |
| 7.4 | Achievements backend: data-driven definitions, evaluator consuming game events, per-user progress and unlock storage, `/api/v1` read endpoints | 5 |
| 7.5 | Achievements UI: achievements page with progress, unlock toast, profile badges | 3 |
| 7.6 | Notifications backend: rules turning game events into notifications, per-category preferences, coalescing and caps, persistent store with 30-day TTL, Socket.IO push to the user, `/api/v1` list / mark-read endpoints, login summary | 8 |
| 7.7 | Notifications UI: toasts, notification center with unread count and mark-as-read, category preferences in the settings | 5 |
| 7.8 | Russian translation of all UI strings (landing, auth, game screens, tutorial, achievements, notifications, API error codes) and the missing-key CI check on every PR | 3 |

**Exit criteria:** the landing and authentication pages ship with the animated ambient scene; achievements unlock from
real game events, including while the player is offline; notifications arrive in realtime and are kept for offline
players; the whole UI is available in English and Russian with a missing-key check in CI — all covered by tests.
