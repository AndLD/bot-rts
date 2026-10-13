[← Phase 7 — Presentation & engagement: landing, auth scene, achievements, notifications, Russian](../phase-7-presentation-engagement.md)

# Phase 7 — Presentation & engagement: landing, auth scene, achievements, notifications, Russian — work log

Append-only log used to resume the phase in a new session (AGENTS.md §7.6). Newest entry at the bottom. Add an entry
whenever a session ends or pauses, or a task finishes; commit it in the same pull request as the work.

## Entry template

```markdown
### YYYY-MM-DD — short summary
- **Tasks:** x.y, x.z
- **Branch:** `feature/x.y-slug` — done | WIP (what remains, what is uncommitted/unpushed)
- **Decisions / deviations from the plan:** …
- **Problems / blockers / findings:** …
- **Next step:** the exact next action
- **Verify with:** commands that show the current state is healthy
```

## Entries

### 2026-10-13 — tasks 7.1, 7.2: ambient scene and the authentication pages
- **Tasks:** 7.1, 7.2
- **Branch:** `feature/7.1-ambient-scene` — done
- **Decisions / deviations from the plan:** the scene is `features/ambient/`: `script.ts` is a pure function of the step number (a miner shuttling to a deposit that runs dry, a gunner trading shots with an enemy and getting a module broken, a repair bot coming to mend it); `AmbientScene` plays it on a `MapRenderer` with the real `AnimationSystem` (timers injected, `pause`/`start`, `showStill` for the poster); `AmbientCanvas` is the React wrapper (`aria-hidden`, pauses on `visibilitychange`, one still picture under reduced motion). Repair has no game event yet, so `AnimationSystem.play(effect)` was added for effects without an event. The reduced-motion check of the system moved to `useSystemReducedMotion` (no store needed), which the public pages use; `useReducedMotion` adds the player's setting on top. All sign-in pages (login/sign-up, forgot and reset password, link results) now stand on `AuthFrame`: the scene, a shade, a link to the landing page, the language switch, and the card.
- **Next step:** task 7.3 (landing page), then 7.10 (privacy policy and consent).
- **Verify with:** `npm run typecheck && npm run test:coverage -w client`

### 2026-10-13 — task 7.3: landing page
- **Tasks:** 7.3
- **Branch:** `feature/7.3-landing-page` — done
- **Decisions / deviations from the plan:** `next-intl` *routing* (a `[locale]` segment and middleware) was not used: the game picks its language in the browser, and a static page needs the language in its HTML. Instead every route group is a root layout of its own (`RootShell` renders `<html lang>`): `(game)` (English markup, client-side language), `(site-en)` (`/`) and `(site-ru)` (`/ru`). The public pages stand in `SitePage` (header with language links to the same page in the other language, footer) over `SiteIntl`, a client provider that is handed only the namespaces the public pages use (`siteMessages`). SEO: `pageMetadata` (title, canonical, `hreflang` alternates with `x-default`, Open Graph, Twitter card with `public/social.png`), JSON-LD (`WebSite`, `VideoGame`), `sitemap.ts` (all `PUBLIC_PATHS` in each language, with alternates; the docs add theirs in 7.11) and `robots.ts`; the site address is `NEXT_PUBLIC_SITE_URL`. The hero is a static `poster.svg`; the ambient scene loads 1.5 s after the page (`LazyAmbient`, `next/dynamic`). Links lead to `/docs`, `/docs/api`, `/docs/examples`, `/privacy`, which arrive with 7.11 and 7.10; the sign-up links open `/auth?mode=signup`. **Lighthouse CI:** `lighthouserc.json` (`@lhci/cli`) asserts SEO ≥ 0.95 and performance ≥ 0.9 on `/` and `/ru`; a new `lighthouse` job in CI builds and serves the client and runs it (locally: performance 0.99, SEO 1.0, accessibility 1.0). The web font got `font-display: swap`, which took the performance score from 0.90 to 0.99. Reports are written to disk, not uploaded.
- **Next step:** task 7.10 (privacy policy and consent).
- **Verify with:** `npm run typecheck && npm run test:coverage -w client && npm run build -w client`; `npm run start -w client` and `npm run lighthouse`

### 2026-10-13 — task 7.10: privacy policy and consent
- **Tasks:** 7.10
- **Branch:** `feature/7.10-privacy-consent` — done
- **Decisions / deviations from the plan:** the policy text is the `privacy` namespace of the message catalogues (English and Russian), rendered by `PrivacyPolicy` at `/privacy` and `/ru/privacy` (static, in the sitemap, linked from the footer and the sign-up form). Its version is `PRIVACY_POLICY_VERSION` in `lib/utils/privacy.ts` (a date): the sign-up form sends it as `acceptedPrivacyVersion`, `LocalAuthService.register` refuses any other value with `400 PRIVACY_NOT_ACCEPTED` and creates nothing, and the accepted version and time are stored on the user (`users.privacy_accepted_version` / `privacy_accepted_at`, migration `20261013090000_privacy_consent`; null for a player that came through a hosted provider and for accounts that existed before). A change of the text needs a new version. The sign-up form has a required check box with a link to the policy in the player's language. **Cookie notice** (`CookieNotice`, on the public pages and the sign-in pages): the game sets only what it needs (the refresh cookie, the token and the language in the browser storage), so the notice informs and the visitor cannot switch anything on — non-essential cookies stay off whatever the answer; the answer is remembered in `localStorage`. The contact address is `NEXT_PUBLIC_CONTACT_EMAIL`. Account deletion exists (task 2.7); there is no export endpoint, so the policy tells players to write for a copy of their data.
- **Open points:** a player who accepted an older version is not asked again when the text changes (there is no re-acceptance flow yet); the Cypress specs of the privacy page, its links and the cookie notice are part of 7.9 (the sign-up spec already checks the check box and its link).
- **Next step:** task 7.4 (achievements backend), then 7.5, 7.6, 7.7, 7.11–7.13, 7.8, 7.9.
- **Verify with:** `npm run typecheck && npm run test:coverage`; `node scripts/e2e.mjs -- --spec cypress/e2e/signup.cy.ts`
