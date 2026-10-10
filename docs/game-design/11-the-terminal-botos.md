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
| `help` | `help` | List available commands. | 🔴 |
| `ls` / `dir` | `ls` | List files in the current drive/directory. | 🟡 |
| `cd` | `cd <path>` / `cd ..` | Change directory / select a drive. | ✅ (drives) |
| `mkdir` | `mkdir <name>` | Create a directory. | 🔴 |
| `cat` | `cat <file>` | Print a file's contents. | 🔴 |
| `edit` | `edit <file>` | Open a **draggable code editor**. New files are validated to `*.js`, `*.ts`, `*.json`, `*.txt` only. | 🟡 |
| `rm` | `rm <file>` | Delete a file. | 🔴 |
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
3. If the link drops **for any reason**, the terminal displays **"Connection interrupted"** centered in the window. 🔴
4. The whole session — commands, outputs, script logs, and errors — is **persisted to the database**. 🟡

## 11.2.1 Communication range ✅

- Each wireless adapter has a **range in cells** (Chebyshev distance). `connect`, `ping` and `sendMessage` succeed only
  if the target's adapter is within the sender's range, **directly or through a relay chain** of the player's own
  bots, i.e. bots of bases owned by the same user (each hop within range of the next).
- If the link breaks (target moves out of range, a relay is destroyed or loses power, the adapter is disabled or
  destroyed), the terminal shows **"Connection interrupted"** (§11.2).
- Higher adapter classes have longer range; relay bots are a deliberate strategy. Class-1 default: **20 cells**
  (tunable config).

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

- Session logs are kept for **30 days**, capped at **5,000 lines per bot** (oldest dropped first); a scheduled cleanup job
  (or time-partitioned tables) enforces the limits.
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
- Quotas are tunable config (class-1 starting value: 64 KB, also used in the base starter kit).
