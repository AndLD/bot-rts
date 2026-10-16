[← Testing](./README.md)

# End-to-end coverage matrix

Every core user and game flow has a Cypress spec. A pull request that adds or changes a user-visible flow adds or
updates its spec and this matrix. The full suite runs in CI on every PR into `develop` (from Phase 2); if it grows past
about 15 minutes it is sharded and run in parallel.

| Flow | Spec owned by |
| --- | --- |
| Sign up → verify email → inactive page → verified | 2.7 (`signup.cy.ts`) |
| Login, logout, token refresh; banned and forbidden users | 2.7 |
| Deploy a base (password, spawn seed); redeploy after a corpse base | 3.8 and 3.13 (`deploy.cy.ts`, `redeploy.cy.ts`) |
| Terminal: `list`, `modules` | 2.7 |
| Terminal: filesystem (`ls`, `cd`, `mkdir`, `cat`, `edit`, `rm`), `help`, stored session lines | 3.13 (`terminal-files.cy.ts`) |
| Craft, assemble, research, `learn`; repair, disassemble; battery exhaustion | 4.7 (`factory.cy.ts`) |
| Restore a corpse base by repairing its wireless adapter | 4.7 (HTTP integration test `api.int.test.ts`: driving a repairer to a lost base from the UI needs the movement of phase 5) |
| Script lifecycle: edit, run, log, `top`, `kill`, shell mode, failing script | 5.11 (`scripts.cy.ts`); restart relaunch with the "rebooted" note: `engine.int.test.ts` (an e2e stack cannot kill the engine thread) |
| Map: fog of war, pan/zoom, cell inspection, opening a bot; animation smoke test | 6.6 (`map.cy.ts`) |
| Storage GUI; factory GUI; windows | 6.6 (`storage-factory.cy.ts`, `windows.cy.ts`) |
| `connect` (range, relay, password, lockout, "Connection interrupted"); `adopt` a bot of another player | 6.6 (`connect.cy.ts`); adopting a stale bot of a lost base: unit tests of `BotAccessService` (the stale bots themselves are Phase 8) |
| Manual control panel and the global / personal category switches | 6.6 (`control.cy.ts`) |
| Tutorial: complete, skip, reopen | 6.9 (`tutorial.cy.ts`) |
| Core gameplay: mining loop, combat to a broken module, energy exhaustion, corpse-base restoration | 6.12 (`gameplay.cy.ts`) |
| Landing page, language switch, auth page scene | 7.9 |
| Privacy policy page, footer and sign-up links, acceptance required at sign-up | 7.9 |
| Achievements (including offline), notifications, notification center, offline summary | 7.9 |
| Player docs: `/docs` navigation and search, language switch, landing link, in-game Help window and contextual "?" links | 7.13 |
| API key lifecycle in the account page (create, shown once, use within scopes, revoke); two-player interaction (contested cell `BLOCKED`, private fog of war, an attack seen by the defender) | 8.13 (`api-keys.cy.ts`, `multiplayer.cy.ts`) |
| Account management: forgot / reset password, change password, change email, delete account | 2.7 |
| Signup validation, expired or reused verification link, login lockout, banned user mid-session | 2.7 |
| Spawn seeds: same code spawns nearby, full seed, expired seed | 3.13 (`spawn-seeds.cy.ts`) |
| Weight / speed / capacity, assembly rejections, broken-module effects, disassembly permissions | 4.7 (unit: `movement`, `assembly`, `capabilities`, `repair-module`; integration: `api.int.test.ts`, `energy.service.int.test.ts`; terminal: `factory.cy.ts`) |
| Script arguments, imports, TypeScript, limits, queued executions, sandbox denial, offline play | 5.11 (`scripts.cy.ts`); the ops budget: `engine-core.test.ts`, `scheduler.test.ts` |
| Relay chains, messages, world consistency, reload / reconnect / token expiry, two tabs, manual-action budget, game category switches (set by a task; the console's own spec is 9.13) | 6.6 (`connect.cy.ts`, `map.cy.ts`, `resilience.cy.ts`, `control.cy.ts`); `sendMessage` / `ping` do not exist yet; the socket reconnect and two tabs are covered by `realtime.gateway.test.ts` and the socket tests of `api.int.test.ts` (Cypress cannot cut a WebSocket); the one-action-at-a-time rule of manual actions: `engine-core.test.ts` |
| Deposit depletion and contest, combat details, items and blueprint items | 6.12 (`gameplay.cy.ts`, `storage-factory.cy.ts`); ammunition, armour and artillery numbers: the unit tests of the combat handler and the weapon module |
| Notification coalescing, translated terminal responses | 7.9 |
| Read-only API key, MCP smoke test (scan, move), corpse base and stale bots seen by other players, adopting a stale bot | 8.13 (`api-keys.cy.ts`, `mcp.cy.ts`, `multiplayer.cy.ts`) |
| Admin console: role-based access, two-factor sign-in, dashboard, ban, inspector, supervision actions, maintenance mode, balance edit and rollback, announcements, the Docs page | 9.13 (`admin.cy.ts`); the authorization matrix of every admin route: `authorization-matrix.int.test.ts` (9.14); the Logs page with the log store (13.3, `admin.cy.ts`) |
| View as player: start with a reason, the banner, every change refused, the audit trail, the exit, access per role | 9.16 (`view-as.cy.ts`) |
| Feature switches: sign-ups, base deployment and the public API switched off from the console and refused, the notices on the screens, switch back | 9.18 (`feature-switches.cy.ts`) |
| Retention settings: a range and a switch changed and saved with a reason, refused values, the typed word, reset, read-only for a moderator | 9.19 (`retention.cy.ts`; that a pass obeys the values: `retention.int.test.ts`) |
| Game time: time of day, day length without a jump, real-world zone, the clock of an open game following without a reload, advancing the clock to finish a craft; reset of the database of a test server | 9.17a (`game-time.cy.ts`), 9.17b (`database-reset.cy.ts`) |
| Resource exchange, auctions, script editions, inbox, wallet and fees | 10.14 |
| Chat (channels, private messages, block, report) and transfers (credits, items, accept / decline / expiry), new-account limits | 10.14 |
| Admin moderation of listings, wallets and chat messages | 10.14 |
| The in-game clock and the day phase, the night filter that does not block map clicks | 11.10 (`daynight.cy.ts`) |
| The starter base runs on a solar panel and burns no oil; energy low is told once however long it lasts; a bot out of energy stays off the radio until the resume threshold | 11.10 (`energy.cy.ts`); the balance of the panel against the generator over game days and the hysteresis edge cases: `energy-balance.test.ts`, `energy-model.test.ts`, `energy-events.contract.test.ts` |
| Automatic reconnection after the API restarts | 11.7 (`reconnection.cy.ts`) |
| Control window layout (also a layout saved narrow), terminal follows new output only when at the bottom | 11.10 (`interface.cy.ts`) |
| Scan snapshots ageing, a script recovering from a stale scan, continuous scanning (live area, diffs, switching off) | 6.12 (`gameplay.cy.ts`: live area and ageing snapshot; the stale-scan recovery by the handler and script-api unit tests) |
| Radio link loss and recovery: out of range, relay destroyed / repaired, tower out of fuel, hatched bots, buffered scans, missed-event summary | 6.6 (`connect.cy.ts`, `radio.cy.ts`: out of range, relay chain, terminal interrupted and resumed, signal bars); relay towers do not exist (relays are the player's own bots); buffered scans and the summary of missed events: `radio-network.test.ts`, `radio-buffers.test.ts`, `useTerminal.test.tsx` |

