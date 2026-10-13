[← Game design index](../GAME-DESIGN.md)

# 15. Screens & HUD

| Screen | Status | Contents |
| --- | --- | --- |
| **Landing page** | ✅ | Public marketing page for the game (§15.3). |
| **Auth** | ✅ | Login / sign-up forms with validation and privacy consent; toggle between them, over the animated ambient map scene (§15.3). |
| **Verification** | ✅ | Landing page for the email-verification link; redirects on success/failure. |
| **Inactive** | ✅ | "Check your email. We have sent verification letter." |
| **Deploy base** | ✅ | The first screen of a player without a base: set the base password (and an optional spawn seed), confirm, deploy; a centred form with side margins. |
| **Monitor (map)** | 🟡 | Canvas map with sprites (§4.3), fog of war, pan/zoom, cell inspection, streamed from the server (Plan 6.1–6.2). |
| **Base terminal** | 🟡 | BotOS terminal + bot list + `connect`. |
| **Bot terminal** | ✅ | Draggable terminal window per connected bot (opened by `connect`); "Connection interrupted" on drop, resumed with a summary when the link is back (Plan 6.5). |
| **Code editor** | 🟡 | Draggable CodeMirror editor, save/close, format; filename validation on create. |
| **Physical storage GUI** | 🟡 | Resources and carried items of a bot; take/drop by manual actions (Plan 6.3). |
| **Factory GUI → Craft table → Assemble** | 🟡 | Blueprint list, resource costs, craft button, then module selection and assembly (Plan 6.4). |
| **Bot list / fleet view** | 🟡 | Simple list of the player's bots with ids, labels, types. |
| **Bot control panel (manual control)** | 🟡 | Per-bot micromanagement UI split into switchable categories (§15.1); generated from the script API (Plan 6.7). One window per bot; every action is a row of three aligned columns (§15.6). |
| **HUD clock and night filter** | ✅ | The in-game time of day and the dark-blue night filter over the map (§15.6, Phase 11). |
| **Connection banner** | 🔴 | Lost / reconnecting / restored, with automatic reconnection (§15.6, Phase 11). |
| **Settings (global + profile)** | 🟡 | Category switches for manual control at game level and per player (§15.1); language, notification categories, reduced motion (§15.2–15.4, §24.2). |
| **Notification center** | ✅ | Unread count, list with a count on coalesced notifications, load more, mark as read, preferences (§24.2). |
| **Achievements** | ✅ | Unlocked and locked achievements with progress (§23). |
| **Script monitor (`top`)** | 🔴 | Running executions with resource usage; kill control. |

---

## 15.1 Manual control (micromanagement) ✅

- **All micromanagement is available from the GUI.** Anything a script can ask a bot to do (move, turn, shoot, aim,
  mine, pick up, drop, store, scan, enable/disable modules, craft, assemble, research, repair, disassemble, connect, …)
  can also be done by hand through a bot's control panel. **Scripts are the automation layer** on top of the same
  actions.
- Manual actions go through the same engine commands as scripts (single-writer rule, §14.2) and obey the same physical
  rules (energy, cooldowns, range, module requirements). ✅ **Manual actions follow exactly the same rules as script
  calls**, including the processor: each manual action costs ops from the bot's `opsPerTick` budget (§12.2.1), so a bot
  with a broken or missing processor cannot be controlled by hand either (the wireless adapter is still required for
  remote control). There is one rule set and no separate manual budget, so fast clicking cannot beat the hardware limits.
- **Categories:** ✅ the micromanagement UI is split into **eight categories** by module role:

  | Category | Actions |
  | --- | --- |
  | **Movement** | move, turn |
  | **Combat** | aim, shoot, reload |
  | **Extraction** | dig, pick, drop |
  | **Logistics** | store, take, transfer between storages |
  | **Fabrication** | craft, assemble, research, learn |
  | **Maintenance** | repair, disassemble, enable/disable modules |
  | **Communication** | connect, ping, sendMessage, adopt |
  | **Trade** | market orders, auctions, bids, buy-now, claiming the inbox (needs a market terminal, §26.2) |

  **Observation** (viewing the map, scanning, inspecting cells and bots) is always on and is not a category. All
  categories are on by default.
- **Switchable at two levels:** categories can be switched on/off in the **global game settings** and in each player's
  **personal profile settings**. ✅ **Global is a ceiling and personal narrows:** a category is available to a player only
  if it is on globally **and** on in their profile. Players can switch categories off for themselves (for example to play
  code-only) but can never enable what the game has disabled. The check is enforced **server-side** (the engine rejects
  manual commands from a disabled category), not only hidden in the UI. Category switches affect **manual** control only;
  scripts are never restricted by them.

---

## 15.2 Map animations ✅

_Implemented (Plan 6.11): move tween, shot, hit, mine, deposit depleted, scan, module damaged / broken, link lost / restored, low energy, with the effect cap, level of detail and reduced motion. Still to come with their events: craft / assemble, repair, disassemble, adopt._

The map renderer (§4.3) plays short **animations driven by game events** (§24.1), only for events the player can see:

| Event | Animation |
| --- | --- |
| Move | the sprite is tweened smoothly from cell to cell over the move's `ticksPerCell` (§8.5), turning to face its direction |
| Shoot / hit | muzzle flash, projectile or tracer along the line, impact spark; floating damage number; artillery arc and splash ring |
| Dig / mine | drill shake with dust particles; the deposit sprite shrinks; a small pop when depleted |
| Repair | sparks and a welding beam toward the target module; a green flicker when finished |
| Disassemble | scrap pieces pop out of the target |
| Scan | expanding radar pulse over the scan radius, after which the revealed cells appear at full strength and start fading with age (§4.3) |
| Craft / assemble | build-up effect at the base, then the new bot "boots" in on its spawn cell |
| Module broken | smoke, then flames if it stays broken; a cracked overlay (§4.3) |
| Link / connect | dotted line between the two bots, pulse on connect; on link loss the bot turns hatched and grey, on recovery the hatching fades out (§11.2.1) |
| Low energy | slow blinking of the bot's energy icon |
| Adopt / control lost | ownership tint cross-fades to the new owner's colour |

- Animations are **cosmetic**: they never affect the simulation and are skipped at low zoom (level of detail).
- A **reduced-motion** setting (global in the profile and respecting the OS `prefers-reduced-motion`) replaces
  movement and effects with instant state changes and simple highlights.
- A cap on simultaneous effects keeps the frame rate stable when many events arrive at once.

## 15.3 Landing page and authentication page ✅

- **Landing page:** a public page at `/` in the same **Next.js app** as the game (static rendering, `next-intl` routes
  `/` and `/ru/`), so it has proper SEO. It presents the game: hero with a live animated scene, how it works (build,
  program, compete), key features (modules, scripts, manual control, persistent world), a gameplay showcase, an FAQ,
  links to the documentation (§15.5) and the public API (§22), and sign-up / log-in buttons. It carries proper SEO and
  social-preview metadata. Unlike the game screens, the landing page is **responsive** (it is the one screen expected on
  phones, §1).
- **Ambient scene:** a self-contained, non-networked simulation rendered with the same canvas renderer and sprite atlas
  as the real map (§4.3), with scripted bots **moving, digging, shooting and repairing**. It uses the same animation
  system (§15.2) and is reused on the landing page and the authentication page.
- **Privacy policy:** a public `/privacy` page (English and Russian) linked from the landing footer and the sign-up form.
  It states what is collected (account email, game data, terminal logs, cookies and tokens), why, for how long, who
  receives it and the user's rights (account deletion, §5.1). Sign-up requires accepting it; the accepted version and
  time are stored with the user. ✅
- **Authentication page:** the login / sign-up forms are shown over the animated ambient scene, redesigned to match the
  landing page. The scene pauses when the tab is hidden and honours the reduced-motion setting.

## 15.4 Languages (i18n) ✅

- The UI is **English by default** and also available in **Russian**, through an i18n framework (`next-intl`).
- The language is chosen from the browser on first visit and can be changed in the profile settings and on the
  landing and auth pages.
- All UI strings (including the tutorial, achievements, notifications and the error-code messages from the API, §10.3)
  are translation keys with English as the source. The API returns **codes and parameters**, never final UI text;
  the client formats them in the active language.
- Free text produced by players (script `log()` output, file names, bot labels) and terminal output from scripts is
  **not translated**. Terminal command responses are translated through message codes.
- More languages can be added by adding a translation file; a CI check reports missing keys.

## 15.5 Player documentation and in-game help ✅

- **Public docs:** a `/docs` section (and `/ru/docs`) in the same Next.js app, statically rendered with SEO metadata,
  a sidebar tree and search. Sections: getting started (first base, bot and script), concepts (map and fog of war,
  ticks, energy, ops budget, weight), the **script API reference**, the **module and recipe catalogue**, the BotOS
  command reference, a gallery of example scripts (§18), and links to the OpenAPI reference and API keys (§22).
- **Generated, not hand-copied:** the script API reference comes from the `lib` types and doc comments, and the
  module and recipe catalogue from the balance config, so numbers cannot drift from the game. CI fails when the
  generated pages are stale. Example scripts in the gallery are executed in the sandbox tests.
- **In-game Help:** a Help window in the window manager renders the same content (one source, no second copy). The
  code editor, terminal (`help <topic>`), factory, control panel and module tooltips link to the matching page, and
  the window offers search and reopening the tutorial (§16.1). The content is bundled, so it works offline.
- Documentation is available in English and Russian (§15.4); the tutorial teaches the first steps, the docs are the
  reference.

## 15.6 Window and HUD behaviour

- ✅ **One window per bot and kind.** The control panel and the storage of a bot are single windows, whether they are opened
  from the toolbar, by clicking the bot on the map or from another window: opening one that is already open brings it to
  the front. Windows remember their place and size per window id.
- ✅ **Control panel layout.** Each action is a row of three columns: the action name, the inputs (they share the free width and
  keep a readable minimum), and the button; the result of the action shows under the row.
- 🔴 **Wider control panel** (Phase 11, task 11.8): a wider default window and a wider inputs column, so placeholders and values
  are readable; the saved layout of an old narrow window is migrated.
- 🔴 **Terminal follows new output only at the bottom** (task 11.9): when lines arrive, the terminal scrolls down **only if it was
  already scrolled to the bottom** just before; a player who scrolled up to read is not pulled down, and scrolling to the bottom
  again resumes following.
- 🔴 **Automatic reconnection** (task 11.7): when the server goes down or the network drops, the client reconnects with backoff
  without a page refresh, re-subscribes to what was open (map stream, terminal sessions, notifications, live scan), refetches
  the data it holds, and shows a connection banner (lost, reconnecting, restored) in both languages; no duplicate toasts or
  windows appear after it.
- ✅ **In-game clock and night filter** (task 11.6): the HUD shows the in-game time and the day phase (§12.5.1). A
  **dark-blue, high-opacity filter** lies over the map canvas, strongest at night (about 0.65), light in the morning and evening
  (about 0.25), none by day, with smooth transitions and reduced motion respected. The filter layer lets pointer events through,
  so map clicks, hover and the cell inspector work at any hour. Implementation: `useGameTime` derives the time from `GET /api/v1/time` and the server-synced clock; `GameClock` shows `HH:MM · phase` in the top-right corner; `NightFilter` is a layer inside `MapCanvas` (under the cell inspector) with `pointer-events: none`, an opacity per phase and a 20 s linear fade.
- ✅ **Relative times** in the notification center ("5 seconds ago") use the current time and are never shown in the future.
