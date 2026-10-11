[← Game design index](../GAME-DESIGN.md)

# 24. Game events and realtime notifications

## 24.1 Game event bus ✅

- The engine emits **typed game events** each tick: `BotMoved`, `ShotFired`, `ShotHit`, `ModuleDamaged`,
  `ModuleBroken`, `ResourceMined`, `DepositDepleted`, `ModuleRepaired`, `ModuleDisassembled`, `ItemCrafted`,
  `BotAssembled`, `BotAdopted`, `ScanCompleted`, `LinkEstablished`, `LinkLost`, `LinkRestored`, `PasswordAttemptFailed`,
  `ExecutionFinished`, `ExecutionFailed`, `EnergyLow`, `BaseControlLost`, `LiveScanStopped`, the trade events of §26.8 (`OrderFilled`, `AuctionOutbid`, `AuctionWon`, `AuctionSold`, …), `TransferReceived`, and so on.
- Events are plain data, emitted after the commands of a tick are applied (§14.2), and are never used to change the
  simulation. They feed three consumers: **map animations** (§15.2), **achievements** (§23) and **notifications**
  (§24.2).
- **Visibility (fog of war):** a player receives an event if it (a) concerns **their own** bots, bases, modules, items, orders
  or wallet (for a bot, only while it is connected to the base network, §11.2.1; events missed while disconnected arrive as a
  summary when the link returns), (b) is the **direct result of their own action** (for example the hit their bot's shot causes on an enemy), or
  (c) happens inside their **live area** (continuous scanning, §4.4), whoever caused it. Everything else is learned only
  through a later scan.

## 24.2 Notifications ✅

- **Realtime:** notifications are pushed over the player's Socket.IO connection as they happen.
- **Persistent:** every notification is also stored (30-day retention, tunable), so the player sees what happened while
  offline. The client shows a **notification center** with an unread count and mark-as-read.
- **Categories** (each can be switched on/off in the profile settings, §15): *Attacks* (your bots or base are hit),
  *Damage and energy* (module broken, battery low, out of fuel, live scan stopped, link lost / restored), *Scripts* (finished, crashed, restarted after a reboot, §12.3.1),
  *Security* (failed password attempts on your bots, a bot adopted, base control lost), *Fabrication* (craft, assembly
  or research done), *Trade* (orders filled, auctions outbid / won / sold, transfers received), *Achievements* and *System* (tutorial, announcements).
- **Anti-spam:** repeated events of one kind are **coalesced** (for example one "under attack" per bot per 30 seconds,
  with a count), and each category has a per-minute cap.
- Notifications are also available through the public API (§22.1) and therefore to the MCP server.

## 24.3 Offline delivery ✅

Notifications created while the player is offline wait in the notification center and are summarised on the next
login (for example "While you were away: 12 events, 2 attacks, 1 achievement"). Email digests and browser push
notifications are in the backlog (§21).
