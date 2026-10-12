[← Game design index](../GAME-DESIGN.md)

# 11. The terminal (BotOS)

Each bot — including the base — runs **BotOS**, a Unix-like command environment. The player interacts through a
terminal window; **every connection session, with all its logs, is stored in the database**. 🟡

## 11.1 Command reference

The 2024 notes list: `ls`/`dir`, `edit`, `rm`, `clear`, `shell`, `connect`, `<filename>`, `reboot`, `help`.
The 2026 notes list: `cd`, `ls`, `mkdir`, `cat`, `edit`, `run`, `shell`, `top`, `kill`, `ping`.
✅ The final command set is the unified set below (including `passwd`, `adopt`, `learn`, and the factory commands `craft`,
`assemble`, `research`, which mirror the Factory GUI and the script API). **MVP core subset** (delivered first): `help`,
`ls`, `cd`, `cat`, `edit`, `rm`, `run`, `shell`, `top`, `kill`, `connect`, `list`, `modules`, `clear`, `exit`; the rest
follow with their features.

The unified command set:

| Command | Syntax | Description | Status |
| --- | --- | --- | --- |
| `help` | `help` | List available commands. | ✅ |
| `ls` / `dir` | `ls` | List the drives, or the files of the current drive/directory. | ✅ |
| `cd` | `cd <path>` / `cd ..` | Change directory / select a drive (`cd` alone or `cd /` goes to the top). | ✅ |
| `mkdir` | `mkdir <name>` | Create a directory. | ✅ |
| `cat` | `cat <file>` | Print a file's contents. | ✅ |
| `edit` | `edit <file>` | Open a **draggable code editor**. New files are validated to `*.js`, `*.ts`, `*.json`, `*.txt` only. | 🟡 |
| `rm` | `rm <file>` | Delete a file or an empty directory. | ✅ |
| `run` | `run <file> [args…]` | Run a script file; its exported `main(bot, …args)` is invoked. | 🔴 |
| `shell` | `shell` | Enter shell mode: each input line is executed as code with `bot` in scope. `exit` leaves shell mode. | 🟡 |
| `top` | `top` | List currently running script executions. | 🔴 |
| `kill` | `kill <execId>` | Stop a running execution. | 🔴 |
| `connect` | `connect <botId>` | Open a new draggable terminal for another bot — **only if that bot has an enabled wireless adapter**, otherwise show an error. | 🟡 |
| `list` | `list` | List the player's bots. | ✅ |
| `modules` | `modules` | List the current bot's modules. | ✅ |
| `ping` | `ping <botId>` | Check link latency/reachability to another bot. | 🔴 |
| `reboot` | `reboot` | Restart the bot's OS, terminating scripts. | 🔴 |
| `craft` | `craft <module> [count]` | At the base factory: craft a module from a known blueprint (§9.3). | 🔴 |
| `assemble` | `assemble <label> <moduleId…>` | At the base factory: assemble a new bot from modules; spawns adjacent to the base (§8.3). | 🔴 |
| `research` | `research <module>` | At the base factory: research a higher class (§9.3). | 🔴 |
| `learn` | `learn <itemId>` | Consume a blueprint item and learn its blueprint permanently. | 🔴 |
| `passwd` | `passwd` | Set or change the bot's access password (§11.2.2). | 🔴 |
| `adopt` | `adopt` | After authenticating on a foreign or stale bot: assign it to the base the connection came from (§11.2.2). | 🔴 |
| `clear` | `clear` | Clear the terminal. | ✅ |
| `exit` | `exit` | Leave shell mode, or log out of the base terminal. | ✅ |
| `<file> [args…]` | `abc 1 2` | Shorthand for running a file by name. | 🔴 |

## 11.2 Connection lifecycle

1. Player opens the base terminal (from the base UI). ✅
2. `connect <botId>`:
   - the target must have a working **wireless adapter** within communication range, directly or through a relay chain
     (§11.2.1), and for a foreign bot with a password the correct password must be supplied (§11.2.2);
   - if so → a new draggable bot terminal opens; 🟡
   - otherwise → an error value is shown. 🟡
3. If the link drops **for any reason**, the terminal displays **"Connection interrupted"** centered in the window, and it **resumes by itself** when the link returns (§11.2.1). 🔴
4. The whole session — commands, outputs, script logs, and errors — is **persisted to the database**. 🟡

## 11.2.1 The radio network: range, relays, link loss and recovery ✅

**The link rule**
- Each wireless adapter has a **range in cells** (Chebyshev distance; class 1: **20 cells**, tunable). Two adapters are
  **linked** when their distance is at most the **smaller** of the two ranges, both adapters work, and both bots have
  energy (an empty battery switches the adapter off).
- The player's **network** is a graph rooted at the adapter of their living base. A bot is **connected** when a chain of
  links leads from the base to it through the player's own bots (bots of bases owned by the same user; stale bots are
  excluded). `connect`, `ping`, `sendMessage` and manual control work only for connected bots.
- Any bot can be a **relay**. A **signal tower** is simply a static bot with a long-range adapter plus a battery and a
  generator (burning oil, §12.5); if a tower loses power, is destroyed or is disabled, every bot behind it loses the link.
- The market terminal (§26.2), chat and transfers (§27) do not use the radio network.

**Signal strength (the indicator).** Every connected bot shows a live **signal strength** from 0 to 4 bars, like a phone:
- For one link the **margin** is `1 − distance / min(range A, range B)`. Bars: 4 at a margin of 0.75 or more, 3 from 0.5,
  2 from 0.25, 1 above 0, and 0 (no signal) when out of range. The thresholds are tunable.
- A bot's signal is that of the **weakest link on its path to the base**, so one stretched hop weakens everything behind it.
  The indicator also gives the number of **hops**.
- It is **informational only**: it has no effect on speed or reliability, but it warns before the link breaks. Optionally the
  player gets a `LinkWeak` notification when a bot drops to 1 bar.
- It updates live: the engine recomputes it whenever a bot or relay moves, and clients receive only the changes of the bar
  level. Scripts read it with `getLinkStatus()` (§10.2).

**When a bot loses the link** (it moves out of range, a relay breaks, loses power or fuel, or an adapter is disabled):
- **Control stops:** manual control and the terminal are refused with `NO_SIGNAL`; the open terminal shows
  **"Connection interrupted"**.
- **Live information stops:** the bot's position, status, scan updates and events no longer reach the player. The map shows
  its **last known state**, drawn **greyed with diagonal hatching** with a "connection lost N s ago" tooltip (§4.3). The
  player gets a `LinkLost` notification.
- **The bot stays autonomous:** its scripts keep running on its own processor. A script can ask `getLinkStatus()` (§10.2) and
  react, for example by returning toward the base; `sendMessage` to the base fails with `NO_SIGNAL`.
- **Nothing is lost:** while disconnected the bot buffers the newest **1,000 scanned cells** and the newest **200 events**
  (tunable); its terminal logs are stored as usual.

**Recovery is automatic.** The engine does not poll: it recomputes connectivity only around what changed (a bot moved, a
relay was destroyed, lost power or was repaired, an adapter was switched). As soon as a path exists again:
- the link is restored, the open terminal resumes and shows the logs written meanwhile;
- the buffered scans are applied to the player's map **with their original `seenAt` times**, so they age correctly;
- the missed events arrive as one **summary**, and the player gets a `LinkRestored` notification.

**Display.** Connected bots show their signal bars (map, bot list, terminal header and control panel, with a tooltip giving the bars, hops and the weakest link); disconnected bots are hatched (above); an optional overlay draws the links, so a weak or broken relay is easy to find.

✅ **Implementation (Plan 5.13):** `RadioNetwork` in the engine computes, per player, which bots of the living base reach it
(widest path: the chain whose weakest link is strongest, then the fewest hops) from the bots in memory — adapter online
(`isConnected`) and working, battery not empty, position, range. It is recomputed only for players whose bots moved or changed
their adapter or whether they have energy, on the next tick. A bot out of reach has a `lostSince` time; manual control of it
(terminal `open`, and every world-changing API action that names it) fails with `NO_SIGNAL`, and `getLinkStatus()` returns
`{ isConnected, signal, hops, weakestLink?, lostSince? }`. The engine emits `radio` events with only the bots whose bars or
connection changed and the game events `LinkLost`, `LinkRestored` (with a summary `missed: { scans, events, byType }`) and
`LinkWeak`. While a bot is out of reach the cells its `scan()` returns are kept in a buffer (newest 1,000, per cell the newest
sighting) instead of the player's map, and the events about it in another (newest 200); on `LinkRestored` the cells reach the
map with their original `seenAt` if newer than what the player knows. The bar margins and buffer sizes are `ENGINE_RADIO_*`
settings.

## 11.2.2 Bot security and takeover ✅

- **Access password:** a bot may have an access password, set by its owner from the bot's terminal (`passwd`). By
  default a bot has **no password** and is open to anyone in range. The owner's own bots connect to each other
  without a password.
- **Foreign `connect`:** connecting to another player's bot requires its password (if one is set) and the target's
  wireless adapter within range (§11.2.1).
- **Brute force:** an attacker can try passwords through the API. Each attempt costs ops and energy and is slow; failed
  attempts are logged on the target bot, and after a tunable number of failures the bot **locks out** new foreign
  connection attempts for a tunable time. There are no special hacking modules for now.
- **Takeover:** successful authentication gives a terminal on the bot; the `adopt` command then re-assigns the bot to
  the **base the connection came from** (`baseId` changes; the bot keeps its modules and its scripts; the previous owner
  loses control). Stale bots (§6.3) keep their last password, so unprotected stale bots can be adopted freely.
- **Bases cannot be adopted.** `adopt` works on ordinary bots only. A base's owner never changes; a base only changes
  through damage and repair (corpse base, §6.3). A foreign player who authenticates on a base gets a terminal there (read,
  sabotage) but cannot take it. Every base gets a **mandatory owner-set password at deploy**.

## 11.2.3 Session log retention ✅

- Session logs are kept for **30 days**, capped at **5,000 lines per bot** (oldest dropped first). The cap is enforced when a line is recorded and age expiry when a session opens (no scheduler needed); a scheduled job may take over at scale.
- **Security events** (failed password attempts, lockouts, `adopt`, `reboot`) are kept for **90 days**.
- All three values are tunable config.

## 11.3 UI behavior

- Terminals are **draggable** windows layered over the game view. ✅ (editor draggable; terminal windows 🔴)
- `edit` opens a **draggable code editor** with syntax highlighting (CodeMirror) and a format shortcut. 🟡
- Multiple terminals can be open simultaneously (base + several bots). 🔴

---

## 11.4 Storage: memory modules as drives ✅

- Files (`*.js`, `*.ts`, `*.json`, `*.txt`) are stored as records in the database; the in-game editor is a view over them.
- **Each memory module is a separate drive** with its own byte **quota**. `cd <drive>` selects a drive; `ls`, `cat`,
  `edit`, `rm` and `mkdir` act on the selected drive.
- Writing past a drive's quota fails with an error value; reading/writing takes the module's `readDelay` / `writeDelay`.
- A bot without a memory module has no drive and cannot store files (the base starts with one, §6.1).
- Destroying a memory module destroys the drive and its files.
- Quotas are tunable config (class-1 starting value: 64 KB, also used in the base starter kit): the module's `quota` property, in bytes.
- Paths are slash-separated; names use letters, digits, `_`, `-` and `.` (not first), up to 64 characters per segment and 8 levels; `mkdir` creates one level at a time and `rm` removes a file or an empty directory.
