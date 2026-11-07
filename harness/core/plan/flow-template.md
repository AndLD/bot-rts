[← Flows](<relative link to the flows index>)

# Flow <n> — <title>

**Releases:** <`<version>`, … — the releases this flow delivers, each declared by at most one flow> · **Needs:** <flow <n>, or —> · **Log:** [`flow-<n>-<slug>.log.md`](<relative link to the log beside it>)

<One paragraph: what the flow delivers and why in this order, with the date the owner approved it. Never copy what a release holds: that is the releases file.>

## Settings

The orchestrator reads this block (the procedure `run-flow`); a setting left out takes its default. Change a setting in its own commit, with a log entry that says why.

```json
{
  "mode": "brainstorm",
  "askAt": "D2",
  "levels": {
    "cut.development": "D1",
    "cut.final": "D3",
    "cut.hotfix": "D3",
    "reports.answer": "D4",
    "reports.close": "D4",
    "contract.change": "D3"
  },
  "executor": "session",
  "reuse": "auto",
  "reuseLimits": { "context": 40, "steps": 3 },
  "commits": "per-step",
  "commands": "any",
  "usage": {
    "subscription": "local",
    "stopAt": { "fiveHour": 85, "weekly": 90 },
    "safetyFactor": 1.2,
    "maxWaitMinutes": 300
  }
}
```

## Steps

| # | Kind | Scope | Needs | Stops for | SP | Est. usage | Model | State |
| - | ---- | ----- | ----- | --------- | -- | ---------- | ----- | ----- |
| 1 | tasks | <a release (`<version>`: its tasks in the order of the releases file), or task and issue ids> | — | — | <SP> | <% of the weekly window (`harness flow estimate <n>` prints it), or —> | <from the markers, or a model> | ⬜ |
| 2 | cut | `<version>` | 1 | — | 1 | — | — | ⬜ |

State: ⬜ not started · 🟡 running · ⏸ waits for the owner · ⛔ blocked · ✅ done. The State column is a cache of the repository's state; the log is the record.

<!--
Rules (the plan method, section 10; delete this comment in a real flow):
- Kinds: `tasks` (build the ids of the scope), `cut` (cut the version of the scope), `consumer-take` (a consuming repository takes the version),
  `triage-fix` (triage the open reports, then fix what the triage made an issue), `decision` (a question for the owner or the orchestrator, with its
  level), `custom` (the only kind with a prompt of its own: put it under "## Step <#>" below the table).
- A scope names ids only: a release, task and issue ids, a version. Never a backlog item, and never a copy of what a release holds; a change of what
  a release holds changes the releases file in the same commit.
- A step inserted midway takes a suffix id (`6c` after `6b`) and never renumbers the others; inserting one is a logged decision of level D2.
- "Stops for": a level (`D2`) or a named reason (`owner review`) at which the orchestrator stops at this step whatever the mode, or —.
- "Executor" and "Model" may be overridden per step in the scope's cell: `(executor: manual)` (`session`, `cli`, `subagent` or `manual`; the order of the executors and its fallbacks are in the runtime contract). `harness flow dispatch <n> <step>` says how the executor hands the step to a worker,
  and whether the previous step's worker continues it (`reuse: auto` within `reuseLimits`).
- One repository: this template has no Repo column, and every step runs in the flow's home repository. To drive a step in another repository (a consumer taking a version), add a
  `Repo` column after `Kind` (the alias of the repository, `home` for the flow's own), and add a row for the alias to the settings, next to the others:
  `"repos": { "app": { "remote": "<owner>/<name>", "role": "consumer", "kinds": ["consumer-take"] } }`. The folder of `app` on this machine goes in the ignored `harness-profile.local.json`
  (`{ "repos": { "app": "../app" } }`), never in the flow. A step there names the work by what it does (`take` + the version in backticks), never by that repository's task ids.
- `harness flow check` holds this shape, `harness flow status <n>` recomputes the State column from the repository, and `harness flow prompt <n> <step>` renders the prompt of a step from the
  standard wording of the step prompts (the plan folder of the framework); only a `custom` step writes its own.
-->
