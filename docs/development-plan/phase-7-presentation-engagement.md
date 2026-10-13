[← Development plan index](../DEVELOPMENT-PLAN.md)

# Phase 7 — Presentation & engagement: landing, auth scene, achievements, notifications, Russian, privacy policy, player documentation (66 SP)

**Status:** ⬜ Not started · **Branches:** none yet (see the [implementation log](#implementation-log)) · **Work log:** [phase-7-log](./work-logs/phase-7-log.md)

Make the game attractive and sticky: the public face (landing page and auth page with a live ambient scene), the
achievements and realtime notification systems built on the game event bus (task 5.10), the Russian translation, and
the player documentation (a public `/docs` section and the same content as an in-game Help window).

| # | Task | SP | Status |
| --- | --- | --- | --- |
| 7.1 | Ambient scene: self-contained scripted simulation (bots moving, digging, shooting, repairing) rendered with the map renderer and animation system; pauses when hidden | 5 | ⬜ |
| 7.2 | Authentication page redesign: forms over the ambient scene, matching the landing page | 3 | ⬜ |
| 7.3 | Landing page as the marketing routes of the Next.js app per design §15.3: static rendering, `next-intl` routes `/` and `/ru/`, SEO metadata (Open Graph, `hreflang`, sitemap, structured data), static poster with lazy-loaded ambient scene, Lighthouse CI gate (SEO ≥ 95, performance ≥ 90) | 8 | ⬜ |
| 7.4 | Achievements backend: data-driven definitions, evaluator consuming game events, per-user progress and unlock storage, `/api/v1` read endpoints | 5 | ⬜ |
| 7.5 | Achievements UI: achievements page with progress, unlock toast, profile badges | 3 | ⬜ |
| 7.6 | Notifications backend per design §24.2: rules from game events, per-category preferences, coalescing and caps, 30-day persistent store, Socket.IO push, `/api/v1` list / mark-read endpoints, login summary | 8 | ⬜ |
| 7.7 | Notifications UI: toasts, notification center with unread count and mark-as-read, category preferences in the settings | 5 | ⬜ |
| 7.8 | Russian translation of all UI strings (landing, auth, game screens, tutorial, achievements, notifications, API error codes, documentation chrome) and of the documentation pages (7.11) and the missing-key CI check on every PR | 3 | ⬜ |
| 7.9 | E2E (Cypress): landing page calls to action → sign-up, language switch (`/` and `/ru/`), auth page with the ambient scene and the reduced-motion fallback, achievement unlock toast and page (including one earned offline), realtime notifications, notification center, offline summary at login, notification preferences; also notification coalescing, translated terminal responses and error codes, the failed-password notification, and the privacy policy page, its links and the sign-up acceptance | 7 | ⬜ |
| 7.10 | Privacy policy and consent: public `/privacy` page in English and Russian (what is collected: account email, game data, terminal logs, cookies/tokens; purposes, retention, third parties, user rights, contact), linked from the landing footer and the sign-up form; sign-up requires accepting it, and the accepted version and time are stored with the user; account export and deletion (task 2.7) are referenced; the cookie notice declines non-essential cookies by default | 3 | ⬜ |
| 7.11 | Player documentation per design §15.5 as the public `/docs` routes of the Next.js app (`/docs`, `/ru/docs`): static rendering and SEO like the landing page, search, and a sidebar tree. Sections: getting started (first base, first bot, first script), concepts (map and fog of war, ticks, energy, ops budget, weight), script API reference **generated from the `lib` types and doc comments** (a CI check fails when the generated reference is stale), module and recipe catalogue **generated from the balance config**, BotOS command reference, example-scripts gallery (design §18, runnable snippets), links to the OpenAPI reference and API keys (§22), FAQ. Linked from the landing page and footer (7.3) | 8 | ⬜ |
| 7.12 | In-game Help: a Help window in the window manager that renders the same documentation content (no second copy), "?" links from the code editor, terminal (`help <topic>` opens the page), factory, control panel and module tooltips to the matching page, search, and a "reopen tutorial" entry; works offline from the bundled content | 5 | ⬜ |
| 7.13 | Documentation quality gates and E2E: link checker over `/docs` and the Help window (no broken anchors or links), missing-translation check covers the docs, example scripts in the gallery are executed in the sandbox test suite so they cannot rot, Cypress specs for `/docs` navigation and search, language switch, a contextual "?" link opening the right Help page, and the landing page link to the docs | 3 | ⬜ |

Task status: ⬜ not started · 🟡 in progress (branch noted in the work log) · ✅ done.

**Exit criteria:** the landing and authentication pages ship with the animated ambient scene; achievements unlock from
real game events, including while the player is offline; notifications arrive in realtime and are kept for offline
players; the whole UI is available in English and Russian with a missing-key check in CI; a privacy policy is published and accepted at sign-up; the player documentation is published at `/docs` in both
languages, generated from the code where it can be (script API, module catalogue) and available in the game as a Help
window with contextual links — all covered by tests.

## Implementation log

Branches and pull requests that implemented this phase's tasks, added when each one is merged (branch names follow
AGENTS.md §7.1).

| Branch | Tasks | PR | Status |
| --- | --- | --- | --- |
| _none yet_ | | | |
