[← Development plan index](../DEVELOPMENT-PLAN.md)

# Phase 7 — Presentation & engagement: landing, auth scene, achievements, notifications, Russian (47 SP)

**Status:** ⬜ Not started · **Branches:** none yet (see the [implementation log](#implementation-log)) · **Work log:** [phase-7-log](./work-logs/phase-7-log.md)

Make the game attractive and sticky: the public face (landing page and auth page with a live ambient scene), the
achievements and realtime notification systems built on the game event bus (task 5.10), and the Russian translation.

| # | Task | SP | Status |
| --- | --- | --- | --- |
| 7.1 | Ambient scene: self-contained scripted simulation (bots moving, digging, shooting, repairing) rendered with the map renderer and animation system; pauses when hidden | 5 | ⬜ |
| 7.2 | Authentication page redesign: forms over the ambient scene, matching the landing page | 3 | ⬜ |
| 7.3 | Landing page as the marketing routes of the Next.js app per design §15.3: static rendering, `next-intl` routes `/` and `/ru/`, SEO metadata (Open Graph, `hreflang`, sitemap, structured data), static poster with lazy-loaded ambient scene, Lighthouse CI gate (SEO ≥ 95, performance ≥ 90) | 8 | ⬜ |
| 7.4 | Achievements backend: data-driven definitions, evaluator consuming game events, per-user progress and unlock storage, `/api/v1` read endpoints | 5 | ⬜ |
| 7.5 | Achievements UI: achievements page with progress, unlock toast, profile badges | 3 | ⬜ |
| 7.6 | Notifications backend per design §24.2: rules from game events, per-category preferences, coalescing and caps, 30-day persistent store, Socket.IO push, `/api/v1` list / mark-read endpoints, login summary | 8 | ⬜ |
| 7.7 | Notifications UI: toasts, notification center with unread count and mark-as-read, category preferences in the settings | 5 | ⬜ |
| 7.8 | Russian translation of all UI strings (landing, auth, game screens, tutorial, achievements, notifications, API error codes) and the missing-key CI check on every PR | 3 | ⬜ |
| 7.9 | E2E (Cypress): landing page calls to action → sign-up, language switch (`/` and `/ru/`), auth page with the ambient scene and the reduced-motion fallback, achievement unlock toast and page (including one earned offline), realtime notifications, notification center, offline summary at login, notification preferences; also notification coalescing, translated terminal responses and error codes, and the failed-password notification | 7 | ⬜ |

Task status: ⬜ not started · 🟡 in progress (branch noted in the work log) · ✅ done.

**Exit criteria:** the landing and authentication pages ship with the animated ambient scene; achievements unlock from
real game events, including while the player is offline; notifications arrive in realtime and are kept for offline
players; the whole UI is available in English and Russian with a missing-key check in CI — all covered by tests.

## Implementation log

Branches and pull requests that implemented this phase's tasks, added when each one is merged (branch names follow
AGENTS.md §7.1).

| Branch | Tasks | PR | Status |
| --- | --- | --- | --- |
| _none yet_ | | | |
