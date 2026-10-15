[← Game design index](./GAME-DESIGN.md)

# 1. Vision & pillars

**Pitch.** A persistent, real-time multiplayer RTS where units are robots you build from parts and program in
JavaScript. Skill is expressed through engineering and code; anything a script can do can also be done by hand from the
GUI, and scripts are the way to automate it (see §15.1).

**Design pillars**

| Pillar | Meaning |
| --- | --- |
| **Programmable units** | Every unit can be automated by player-authored scripts. ✅ All micromanagement is also available by hand from the GUI; code is the automation layer on top of it. |
| **Modular construction** | Bots are arbitrary combinations of pre-defined modules. What you bolt on decides what the bot can *do* and what APIs its scripts may call. |
| **Real-time & fair** | All players share one continuous world. The scheduler guarantees every player's bots get time each tick — nobody runs "first" just because they queued first. |
| **Persistent world** | Map knowledge is stored server-side. Once a cell is scanned, its contents are fixed for everyone; unexplored cells are generated lazily. |
| **Hardware = capability** | Your hardware budget (processor, memory, battery, weight) physically limits your software. Better scripts need better machines. |
| **Sandboxed creativity** | Player code may only touch the game through an approved API. It can never reach the server, the database directly, or other players' internals. |

**Genre:** RTS (not turn-based), multiplayer.
**Perspective:** top-down 2D grid map, canvas-rendered.
**Platforms:** ✅ **desktop-first.** Layouts target desktop browsers (draggable terminals, code editor, canvas map). There is
no phone/tablet layout for the game screens in the initial release; a read-only mobile view is in the backlog (§21). The
public **landing page** is the exception and is responsive (§15.3).
**Languages:** ✅ English by default, Russian through i18n (§15.4).
**Session shape:** persistent world; players log in and their robots keep acting according to their scripts.
**Offline play:** ✅ scripts and bots **keep running 24/7 while the owner is logged out**. Bases and bots can therefore be
attacked while their owner is offline; defense must be scripted.
**Goal:** ✅ **Endless sandbox.** There is no victory condition, no seasons and no world resets. Players set their own goals (economy, territory, defense). A leaderboard is out of scope for now.
