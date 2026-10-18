[← Game design index](./GAME-DESIGN.md)

# 20. Open questions

This is the **register of every open point of the design**. A rule in the design is decided; a point that is not decided
carries its id (`Q3`) in the section where it appears, and has one row here. The scan of `npm run docs:check` flags a marker
word (`TODO`, `TBD`, "to be decided", "not yet", "for now", "to be revisited" and the like) in a design file that names no id of
this register and no entry of the backlog (§21), so a new hidden open item cannot appear unnoticed.

A row is removed when its answer is written into the section. The columns:

- **Kind:** _needs a decision_ (the owner must decide), _needs research_ (a measurement or spike answers it), _deferred_ (decided
  to wait; it blocks nothing), _planned_ (decided; a task writes it down), _decided, to be written_ (decided; the text of the
  section still shows the old rule until the named task lands).
- **Section:** where the point appears; the answer is written there.
- **Blocks:** the plan task that cannot be built before the answer, or _none_.
- **Owner:** who answers it. The owner is the project owner (the person who accepts the design); the plan task is named when the
  answer is part of that task.

| Id | Question | Kind | Section | Blocks | Owner |
| --- | --- | --- | --- | --- | --- |
| Q1 | The default costs and craft times of the recipe table are initial values; they are tuned after playtesting. | deferred | §9.3 | none | owner |
| Q2 | The default tick rate and the module timings converted to ticks are revisited after load tests. | needs research | §12.2 | none | owner |
| Q3 | The capacity guard-rails of an engine thread (bots per thread at the default tick rate) are estimates; a benchmark spike validates them. | needs research | §12.2.2 | none (a load harness exists) | owner |
| Q4 | The number of consecutive crashes after which an execution is marked `killed` is only said to be tunable; no default is specified. | needs a decision | §12.3.1 | none | owner |
| Q5 | Deleting an account still removes the account's bases from the API process, not through the engine. | needs a decision | §14.2 | none (a candidate for Phase 12) | owner |
| Q6 | A retention window for the audit trail itself: it is append-only and never deleted today. | needs a decision | §25.6 | none | owner |
| Q7 | The `circute` module of the original notes is undefined. | needs a decision | §6.1 | none | owner |
| Q8 | The `BotAdopted` game event, and an adoption rate limit above the energy cost, are not specified. | deferred | §11.2.2 | none | owner |
| Q9 | Special hacking modules do not exist; brute force costs ops and energy only. | deferred | §11.2.2 | none | owner |
| Q10 | The generated editor typings are not wired into the in-game code editor. | deferred | §10.1.1 | none | owner |
| Q11 | What a deploy answers when the base-spawn search exhausts its attempts (`WORLD_SPAWN_ATTEMPTS`) without a free cell. | needs a decision | §4.1 | none | owner |
| Q12 | What the id of a bot becomes when its wireless adapter (whose id is the bot's id) is replaced. | needs a decision | §8.1 | none | owner |
| Q13 | The lifecycle of a crafting job: when the resources are consumed, and what happens to the job when the energy runs out. | needs a decision | §9.3 | none (crafting is built) | owner |
| Q14 | Wood and stone have no sink: nothing in the recipes consumes them. | needs a decision | §9.1 | none | owner |
| Q15 | The first source of iron on a fresh base: the starter kit is too small to craft the first module (finding H-20261017-15). | needs a decision | §6.1, §16.1 | none (task 12.3) | owner |
| Q16 | Notification rules for the Trade and System categories. | planned | §24.2 | 10.12 | owner |
| Q17 | Map animations for craft, assemble, repair, disassemble and adopt. | deferred | §15.2 | none | owner |
| Q19 | The script `Math.random()` is the engine's seeded random function (decided 2026-10-18); §10.2 does not say so yet. | decided, to be written | §10.2, §12.4 | none | task 15.6 |
| Q20 | The script function `connect(botId, password?)` takes the password, with the lockout of the terminal (decided 2026-10-18); §10.2 shows `connect(botId)`. | decided, to be written | §10.2, §11.2.2 | none | task 15.6 |

Rows Q19 and Q20 close when their task merges. The questions of the Phase 10 market of the harness quality review of 2026-10-17
(H-20261017-13 and -14) were decided by the owner on 2026-10-17 and 2026-10-18 and are written into §26, §27, §24 and §25,
including the system seller (§26.10).
