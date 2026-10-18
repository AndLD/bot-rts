[← Game design index](./GAME-DESIGN.md)

# 24. Game events and realtime notifications

## 24.1 Game event bus

- The engine emits **typed game events** each tick: `BotMoved`, `ShotFired`, `ShotHit`, `ModuleDamaged`,
  `ModuleBroken`, `ResourceMined`, `DepositDepleted`, `ModuleRepaired`, `ModuleDisassembled`, `ItemCrafted`,
  `BotAssembled`, `BotAdopted`, `ScanCompleted`, `LinkEstablished`, `LinkLost`, `LinkRestored`, `LinkWeak`, `PasswordAttemptFailed`,
  `ExecutionFinished`, `ExecutionFailed`, `EnergyLow`, `BaseControlLost`, `LiveScanStopped`, the trade events of §26.8 (`OrderFilled`, `AuctionOutbid`, `AuctionWon`, `AuctionSold`, `EditionSoldOut`, `DeliveryWaiting`, `WalletFrozen`, …), `TransferReceived`, `TransferAccepted`, `TransferDeclined`, `TransferExpired`, and so on.
- Events are plain data, emitted after the commands of a tick are applied (§14.2), and are never used to change the
  simulation. They feed three consumers: **map animations** (§15.2), **achievements** (§23) and **notifications**
  (§24.2).
- **Visibility (fog of war):** a player receives an event if it (a) concerns **their own** bots, bases, modules, items, orders
  or wallet (for a bot, only while it is connected to the base network, §11.2.1; events missed while disconnected arrive as a
  summary when the link returns), (b) is the **direct result of their own action** (for example the hit their bot's shot causes on an enemy), or
  (c) happens inside their **live area** (continuous scanning, §4.4), whoever caused it. Everything else is learned only
  through a later scan.

**Implementation (Phase 5).** Publishers (movement, mining, combat, scans, executions, energy, the radio network) put events
into an `EventOutbox` during the tick. After the commands and the radio refresh, `GameEventBus.deliver()` picks the audience of
each event: its `parties` (the players and bots it concerns) while the bot is connected, otherwise the event goes into the
per-bot buffer of §11.2.1 and arrives as a summary on reconnection; link events are always delivered; players whose live area
contains the event's `location` get it too. The engine thread hands each delivery to the API thread as `{ type: 'game' }`,
where `GameEventDispatcher` fans it out to its consumers, and `RealtimeGateway` pushes it to the player's sockets (room
`user:<id>`) as `game-event`, next to `radio-changes`, `vision`, `execution` and `script-log`. Animations, achievements and
notifications are such consumers, outside the tick path.

**Events are edges, not levels.** An event says that something **happened or began**; it is never repeated while a state merely
goes on. A publisher that sees a lasting state on every tick or cycle (a generator without oil, a low battery, a link that stays
down) must raise the event only when the state begins, and keep the state where it survives a restart (the module properties,
§12.5), so a restart does not tell it again; the notification layer's coalescing (§24.2) is a second line of defence, not a
substitute. Three kinds of events exist:

| Kind | Rule | Examples |
| --- | --- | --- |
| Result of an action | once per action | `BotMoved`, `ShotFired`, `ShotHit`, `ModuleDamaged`, `ResourceMined`, `ScanCompleted`, `CraftOrdered`, `BotAssembled`, `PasswordAttemptFailed` |
| Edge (a state begins or ends) | once per change of state, state persisted | `OutOfFuel`, `EnergyLow` (flags in the generator and battery properties), `LiveScanStopped` (the scanner switches itself off, so it cannot repeat), `ModuleBroken` (only when the condition falls from above 0 to 0), `DepositDepleted`, `LinkLost` / `LinkWeak` / `LinkRestored` (raised on a change of the link compared with the previous refresh; nothing is told on the first look after a restart), `ExecutionFinished` / `ExecutionFailed` (once, when the execution ends) |
| Level (a state that lasts) | never an event; shown as state in the UI | the energy level, the link bars |

_Audited (Phase 11, task 11.1):_ every event type above is classified. The contract tests
(`energy-events.contract.test.ts`, and the lasting-link test in `radio-network.test.ts`) run a bot through hundreds of ticks in
an unchanged bad state (no oil, low battery, a live scanner without energy, an empty battery, a weak or lost link) and fail if any
event type fires more than once. A flapping link caused by the energy edge is removed by the power-on hysteresis (§12.5, task 11.5).

## 24.2 Notifications

- **Realtime:** notifications are pushed over the player's Socket.IO connection as they happen.
- **Persistent:** every notification is also stored (30-day retention, tunable), so the player sees what happened while
  offline. The client shows a **notification center** with an unread count and mark-as-read.
- **Categories** (each can be switched on/off in the profile settings, §15): *Attacks* (your bots or base are hit),
  *Damage and energy* (module broken, battery low, out of fuel, live scan stopped, link lost / restored / weak), *Scripts* (finished, crashed, restarted after a reboot, §12.3.1),
  *Security* (failed password attempts on your bots, a bot adopted, base control lost), *Fabrication* (craft, assembly
  or research done), *Trade* (orders filled, auctions outbid / won / sold / cancelled, edition copies sold and editions sold out, a delivery waiting for inbox space or failed, a wallet frozen, transfers received, accepted, declined or expired), *Achievements* and *System* (tutorial, and the announcements that admins send to every player from the console, §25.3: the kind is `announcement`, its text is the admin's own).
- **Anti-spam:** repeated events of one kind are **coalesced** (for example one "under attack" per bot per 30 seconds,
  with a count), and each category has a per-minute cap on new notifications (a repeat that joins an existing one does not count).
  A coalesced repeat updates the count in the notification center and does not raise a new toast.
- Notifications are also available through the public API (§22.1) and therefore to the MCP server.

**Implementation (Phase 7).** `NotificationService` is a game-event consumer in the API process. Rules (`candidatesOf`) map an event to a notification for the player whose entity it concerns: *Attacks* `underAttack` (a shot that hit their bot, coalesced), *Damage and energy* (`moduleBroken`, `energyLow`, `outOfFuel` and `energyLow` (told when the state begins, not on every tick: the generator and the batteries keep `isOutOfFuel` / `isLowReported` in their properties, so a restart does not tell again; they are cleared when the generator runs on oil again and when the energy is not low), `liveScanStopped`, `linkLost`, `linkRestored`, `linkWeak`), *Scripts* (`scriptFinished`, `scriptFailed`), *Security* (`passwordFailed`: the engine publishes `PasswordAttemptFailed` for the owner of the bot when `connect` fails with a wrong password), *Fabrication* (`botAssembled`, and `craftDone` / `researchDone`, which are stored when the order is given and told when the factory's `readyAt` has come: a stored notification waits with `deliveredAt` empty and a timer delivers it), and *Achievements* (`achievementUnlocked`). The API sends the `kind` and its `params`, never a text. Repeated events of one kind about one bot within `NOTIFICATION_COALESCE_MS` (30 s) are one notification with a `count`, until the player reads it; each category is capped at `NOTIFICATION_CAP_PER_MINUTE` (30) per player; the preferences are per category in `user_settings.notification_categories` (all on by default). Notifications are stored for `NOTIFICATION_RETENTION_DAYS` (30) and are pushed as the socket event `notification` (also when one is coalesced: the same id comes again with the new count). `/api/v1/notifications` lists (newest first, `limit`, `before`, `unread`), `/summary` gives the unread count by category (the "while you were away" line of §24.3), `/read` marks some or all as read, `/preferences` reads and changes the categories. *Trade* and *System* have no rules yet (Q16: Phase 10 and announcements).

## 24.3 Offline delivery

Notifications created while the player is offline wait in the notification center and are summarised on the next
login (for example "While you were away: 12 events, 2 attacks, 1 achievement"). Email digests and browser push
notifications are in the backlog (§21).
