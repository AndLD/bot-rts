# Development plan: structure and rules

How a development plan is organized and maintained. This file is the **method** and is project-neutral, so it can move to a
blueprint unchanged. What belongs to one project (file names, status symbols, estimation scale, gates, the resume phrase) is in
the plan bindings (the project's `bindings.md` next to the plan index). The plan itself is the index document named there.

---

## 1. Purpose

A plan turns the product knowledge and the quality bar into ordered, deliverable work, and carries the state of that work so
any session, human or agent, can stop and resume from the repository alone. It answers four questions:

1. What is being built, in what order, and why this order?
2. What is done, in progress and not started?
3. What must be true before work is released or deployed?
4. What do I read and update to continue?

## 2. Structure

```
<plan folder>/
  <index>.md        the plan: summary, order, scope, gates, how to resume, contents (the only entry point)
  bindings.md       this project's values for the method
  phases/           one folder per phase, and the phase bindings
    phase-<n>-<slug>/
      README.md     the phase index: goal, order, exit criteria, and the task table generated from the task files
      <id>.md       one task: its description, status, size, marker, dependencies and the link to its log
      <id>.log.md   the task's append-only log, used to resume a session
      log.md        what concerns the whole phase (decisions, pauses, the close)
  issues/           the issue queue: the defects and improvements found in use (section 8)
  backlog/          the backlog: the feature requests, optional (section 9)
  releases.md       the release order, optional (section 3)
  flows/            the flows that run the releases, optional (section 10)
  cross-cutting/    documents that apply to every phase (section 4)
```

The method and its templates are the framework's (`core/plan/`): this file, the rules of a phase file ([`phases.md`](./phases.md)), the
templates of the index ([`index-template.md`](./index-template.md)), a phase index ([`phase-index-template.md`](./phase-index-template.md)), a task ([`task-template.md`](./task-template.md)) and a task log
([`task-log-template.md`](./task-log-template.md)), the definition of done ([`definition-of-done.md`](./definition-of-done.md)) and the guiding
principles ([`guiding-principles.md`](./guiding-principles.md)). The project's plan folder holds only its own files.

Rules of the structure:

- **One entry point.** Everything in the plan folder is reachable from the index. A document that is not linked from the index does not exist for an agent.
- **One owner per fact.** The index owns the summary (phase names, sizes, status, order); a phase index owns the goal, the order and the exit criteria, and a task file owns its task; a work log owns the session history; a cross-cutting document owns its rule. Other places link; they do not copy.
- **Add by adding.** A new phase is one new folder in `phases/` (its index and its work log), plus one row in the index summary and one line in its contents. Nothing else is edited by hand.
- **Specific content stays out.** The plan states *what and when*. How to build (tools, commands) lives in the stack documents; what the product is lives in the product knowledge. The plan cites them by link and section id.

## 3. The index document

Required sections, in this order (template: [`index-template.md`](./index-template.md)):

| Section | Content |
| ------- | ------- |
| Introduction | Goal of the plan and the sequencing principle, in a few sentences |
| Legends | Status symbols of phases and tasks, the estimation scale and what an estimate includes |
| Summary | One table: phase number, theme, size, the range of agent-complexity markers when the plan uses them (section 7), status, and a total row |
| Order of development | The actual order when it differs from the numbering, with the reason; where the project ships versions and the profile names a releases file, a generated block (the current release, the next, a link to the file, and a link to the flows index where the project has flows) instead, and the order is the file ([`releases-template.md`](./releases-template.md)) |
| Scope definition | What the finished product is for this plan (the minimum releasable scope), and what is excluded |
| Gates | Conditions that must hold before the product is deployed or released, naming the tasks that satisfy them |
| Resuming work | The request forms that start a session, what the session reads first, when it stops, who approves what |
| Contents | Links to every phase, cross-cutting document and work log |

Rules:

- The summary table is derived from the phase files. When a phase changes status or size, the index is updated in the **same change**. The plan-summary command of the profile writes it, and the contents list, between their marker comments (see the template).
- Numbers are identities, not order. Never renumber a phase or a task: other documents cite them. Record a different order in the releases file where the project has one (section 3), else in the "Order of development" section of the index.
- A total counts only what the legend says it counts. The issue queue is shown apart from the phases' totals.
- A gate names task ids, not prose, so it can be checked mechanically.

## 4. Cross-cutting documents

Documents that apply to all phases live in `cross-cutting/`. A document belongs there only if it is referenced by more than one
phase and is not a rule of the product. Typical kinds:

| Kind | What it holds |
| ---- | ------------- |
| Guiding principles | The sequencing and delivery principles every phase follows; the framework's [`guiding-principles.md`](./guiding-principles.md) unless the project adds its own |
| Definition of done | A pointer to the single place where "done" is defined; it never restates the checklist (the framework's [`definition-of-done.md`](./definition-of-done.md)) |
| Risk register | Risks with likelihood, impact and mitigation, reviewed at each milestone |
| Decision records | A design record (RFC) that a phase task requires before implementation, kept with the decision and its date |

The bootstrap writes a template for two of them once into a new project: a risk register and the index of the decision records with the template of a record (the roles `documents.riskRegister` and `documents.rfcs` of the document map; a project that leaves a role empty has no such file, and one that has the documents already adds nothing).

Each cross-cutting document has one owner and is linked from the index. A decision record is immutable after acceptance; a later
decision supersedes it with a new record and a link.

## 5. Work logs

One append-only log per task, `<id>.log.md` beside its task file, and `log.md` in the phase folder for what concerns the whole phase (a phase kept as one file, the older layout, has one log in `phases/work-logs/` and a fragment per task in `phases/work-logs/phase-<n>/`; the profile names them); newest entry at the bottom, written when a session ends, pauses or finishes a task. The entry
template lives inside each log. The log is the resume point: it states what is done, the exact next step and the commands that
verify the current state. The log is part of the change that it describes.

## 6. Maintaining the plan

| Event | Update |
| ----- | ------ |
| A phase starts | Phase file status, index summary |
| A task starts or finishes | Task status in the task file (the phase index table is regenerated by `harness plan summary`), the task's log (the implementation log is printed from the merged pull requests; the older phases keep their table) |
| A phase finishes | Exit criteria checked, phase file and index status, work log, risk review |
| The scope changes | Phase file tasks or a new phase, index summary and total, gates if affected, the product knowledge if a decision changed |
| A decision changes the order | The releases file (else the "Order of development" section of the index), with the date and the reason |
| A flow runs a step | The flow's State column and its log, by the orchestrator (section 10) |

Consistency checks (done in review, automated where possible): the index summary agrees with each phase file; every phase is in
the contents; every gate task exists; every task cited elsewhere exists; no document in the folder is unreachable; where the plan uses
agent-complexity markers, every open task carries one (section 7).

## 7. Agent-complexity markers (optional)

A plan may rate each task by the **reasoning** it needs, so that the owner or an orchestrator gives it a model and an effort that fit. A
marker rates the reasoning, not the size: a large mechanical task is light, a small decision with wide consequences is heavy. The scale and
the meaning of each marker are a profile role (section 4 of the profile), and so is the model map, the model and effort for each marker.
The framework's scale has three markers:

| Marker | Meaning |
| ------ | ------- |
| `C1` | routine: mechanical, fully specified, obvious to verify |
| `C2` | standard engineering: a component to a clear specification with tests, tools to work out |
| `C3` | judgment: research, correctness-critical design, synthesis |

Rules:

- **Where the plan uses markers**, the task table of a phase has an `Agent` column just before the size (in a phase folder, every task file has an `**Agent:**` field), and every **open** task (not
  started or in progress) carries one marker of the scale, written `C` and a number.
- **Done tasks are exempt.** A project that turns the markers on does not rate its history; a marker recorded on a done task stays.
- **The index shows the range.** The summary gives each phase the range of its markers, lightest to heaviest (`C1–C3`, one marker
  alone, or `—` when no task has one), written by the plan-summary command with the rest of the summary.
- **Conformance.** The documentation check names every open task without a marker, so a new task is rated when it is added.
- **Re-rating.** A marker changes when the scope of its task changes, in the change that changes the scope; a re-rating by the owner
  is recorded in the phase file or its work log with the date.
- **On or off.** The bootstrap turns the markers on. A project turns them off by removing the scale from the profile; the column and
  the range are then absent, and nothing is checked.

## 8. The issue queue

The defects and improvements found in use are not a phase: a phase has a goal, exit criteria and an end, and the work found in use has none, so keeping it
in a phase that never ends distorts the totals and mixes defects with design work that belongs to a phase. They are an **issue queue** next to the phases,
a folder named by the profile (`paths.issues`) in the layout of a phase folder:

| File | Content |
| ---- | ------- |
| `README.md` | the index of the **open and in-progress** issues only, generated by the plan-summary command: issue, title, area, marker, size, status, reports |
| `I-<n>.md` | one issue, from the [issue template](./issue-template.md): ids of its own (`I-<n>`, never reused), a status line (`Status`, `Agent`, `Size`, `Area`, `Reported`, optional `Formerly` and `Log`) and the description |
| `I-<n>.log.md` | the issue's append-only log, beside it |
| `archived/` | the finished issues, with their logs, and a generated `README.md` that lists them |

- **Branch and claim.** An issue is worked on a branch `bugfix/I-<n>-<slug>`; its claim and its commits carry `Plan: I-<n>`, as a task's do. "Work the issue queue" and
  "Fix I-<n>" approve the pull requests of the issues they name, as "Start Phase N" approves a phase's.
- **Area and reports.** Each issue records an `Area:` from the list of areas of the framework's migration notes (or `Unclassified`), and in `Reported:` every report on the
  host that points to it (several reports can be one problem). The index and the archive show the title and the area, so that a new report is matched against the
  indexes before any issue file is opened.
- **Archive.** When an issue is done (✅) the plan-summary command moves its file and its log into `archived/`, lists it in the archive's index and follows every link
  to them. An agent that works the queue reads the open index, never the archive; the archive is read to find out whether a report is a problem that was fixed already.
- **Size.** The plan index shows the open issues and their size on a line of their own, apart from the phases' totals.
- **A move never renames a planned task.** A planned task keeps its id wherever the plan goes, so that an order written by id survives. When a project turns an
  open-ended phase into a normal phase, only its tasks that have not started and that no order names (the defects) become issues, each naming its old id
  (`I-1, formerly 12.5`); a task in progress or done never moves. The check of the plan fails when a release order (the releases file or the order of development of the index) or an execution order names an id
  that exists nowhere: in a phase, or in the queue or the backlog, or their archives, under its old id.
- **A request for something new is not an issue.** An issue is something that exists and is wrong or lacking in use; a request for something that is not there is an item of
  the backlog (section 9). A project that has a backlog puts a feature request there, and "Work the issue queue" and "Fix I-<n>" do not approve building it.

## 9. The backlog

A **backlog** is a place for what the owner has **not approved yet**: the **feature requests**, what someone asked for that is not there. It is a second queue beside the issue
queue and optional like it, but it holds proposals, not work. An item has no phase, no release, no marker and no claim, and **it is never started as it is**: it keeps feature
requests out of the issue queue, which a session works through on the phrase "Work the issue queue", and out of the phases, which have a goal and an end. When the owner decides to
do one, the item is **promoted** into a task of a phase, and only that task is built. A folder named by the profile (`paths.backlog`; a project without the role has no backlog; a
project that sets it later has the folder, its two indexes and the block of the plan index created by `harness plan summary`) in the layout of the issue queue:

| File | Content |
| ---- | ------- |
| `README.md` | the index of the **proposed** items only, generated by the plan-summary command: item, title, area, size (a hint, when given), status, source |
| `B-<n>.md` | one item, from the [backlog template](./backlog-template.md): ids of its own (`B-<n>`, never reused), a status line (`Status`, optional `Size`, `Area`, `Source`, optional `Formerly`; `Promoted to` once promoted) and the description |
| `archived/` | the **promoted** items, each naming its task, and a generated `README.md` that lists them |

- **Status.** An item is `Proposed` or `Promoted`; it has no 🟡 and no ✅, so nothing is ever "in progress" in the backlog. A proposed item has no branch, no `Plan: B-<n>` claim and no log.
- **Source.** Every item says where it came from in `Source:`: `report` followed by the link of each report on the host that asks for it (several reports can ask for one
  thing), `owner` for a request of the owner's, `agent` for a proposal of an agent. The check of the plan fails on any other value. The triage of reports adds the item when a
  report is a feature request (the relation `feature`) and, when the item already exists, adds the report to its `Source:`; the answer to the report says that the request waits for the owner's decision.
- **Promotion.** The owner's decision is `harness plan promote <B-n> --phase <n> [--agent <marker>] [--size <n>] --approved`. It writes the next task of the phase from the item (its title and
  description, its source, a link to the item), with the marker and the size the owner gives or the item holds; sets the item to `Promoted` with `Promoted to: <task id>`; moves it to
  `archived/`; and runs the plan summary, which adds the size to the phase and the task to its table. From then on the work is the task: it is claimed, branched, built and logged like any task.
- **Not startable.** A release order, an execution order or a `Needs` that names a proposed item is a problem of the check of the plan: a name that is not a task of a phase is not approved work.
  The phrases that approve phases and issues approve no item either. A session that is asked to build a proposed item asks the owner to promote it first.
- **Area and archive.** As in the issue queue: an `Area:` from the list of the migration notes (or `Unclassified`), and a promoted item is moved to `archived/` by the plan-summary
  command. The plan index shows how many proposals wait and how many were promoted, apart from the phases' totals.
- **A move keeps the number.** An issue that is found to be a feature request moves to the backlog as a new item that names the issue (`B-1, formerly I-6`); the number `I-6`
  is never given to another issue, and an order written by `I-6` still resolves once the item is promoted.

## 10. Flows

A **flow** is an ordered chain of steps that delivers one or more releases of the releases file, run by an **orchestrator** (an agent session) that hands each
step to a worker, decides or asks, and logs. It replaces the owner running the releases by hand, one prompt per session. Flows are optional, and only for a
project that has a releases file; the profile names their folder (`paths.flows`), and `harness plan summary` creates its index the first time.

| File | Content |
| ---- | ------- |
| `README.md` | the index: flow, releases, mode, size, estimated usage, status; generated by the plan-summary command and linked from the releases block of the plan index ([template](./flows-index-template.md)) |
| `flow-<n>-<slug>.md` | one flow, from the [flow template](./flow-template.md): its releases (`Releases:`), its order after other flows (`Needs: flow <n>`), a settings block and the steps table |
| `flow-<n>-<slug>.log.md` | its append-only log, from the [flow-log template](./flow-log-template.md): the claim, each step's start and end with its usage and report, each decision with its level, the options, the orchestrator's own analysis before the worker's recommendation, the choice and who decided, and every stop with its digest |

- **Like phases.** Numbers are identities; the order between flows is the `Needs:` line, else the number. A finished flow stays in place. Several flows per project; a release
  belongs to at most one flow, a release in no flow is not planned to run, and one flow may hold every release.
- **Settings** (a JSON block, every key optional): `mode` (`brainstorm`, the default, asks the owner from `askAt` up; `seamless` decides everything and keeps a digest), `askAt`
  (`D1` to `D4`, default `D2`), `levels` (the level of a kind of decision: a development cut `D1`, a final cut, a hotfix or a change of the meaning of a contract `D3`, answering or closing reports `D4` by default),
  `executor` (`session`, the default, `cli`, `subagent` or `manual`; a step may override it; session, cli and manual are an order, each the fallback of the one before for one step at a time, as the runtime contract says), `reuse` (`auto` or `never`), `orchestratorLimits` (`context`: the orchestrator's own limit in percent of its window, 50 by default, at which it writes a handoff entry and continues in a new session), `reuseLimits` (when `auto` may continue the previous worker: `context`, its context below that percent of its window, 40 by default; `steps`, fewer steps run, 3 by default; `cacheMinutes`, how long the prompt cache lives, else the runtime adapter's value), `commits` (`per-step`, the default, or `per-cut`), `commands` (`any`, the default: the workers write commands as they like, heredocs included; `plain`: the prompt of each step asks for files written by the runtime's edit and write tools, no nested commands or subshells, and independent commands as parallel calls, which a strict permission mode can check before they run), `permissions` (what a worker started by a command may do, in the runtime's own words — `{ "mode": …, "allow": [tools by name] }`; absent from a flow, it is the project's default (the profile role `flows.permissions`, the same shape), and absent there too, such a worker is refused every edit and command; a flow's own setting wins; the owner's choice, and a session the runtime's application starts gets it by the means the application has: the mode it starts in, and the project's allow rules for the tools, which `harness flow dispatch` names; the mode is logged beside the model of the step), `usage` (`subscription`, `local` by default: read from `usage.subscription` of the
  ignored local profile file, else from the plan the account reports; `stopAt`, the thresholds of the 5-hour and the weekly window, 85% and 90% by default, and `cost` for an API key, the money the flow may spend; `safetyFactor`, 1.2 by default, the estimate is multiplied by it; `maxWaitMinutes`, 300 by default, how long the orchestrator waits for a window's reset before it stops for the owner) and `repos` (the home repository only, by default).
- **Steps.** The table `# | Kind | Scope | Needs | Stops for | SP | Est. usage | Model | State`, with a `Repo` column after `Kind` when a step runs in another repository (below); without it every step is the home repository's. The kinds: `tasks`, `cut`, `consumer-take`, `triage-fix`, `decision`, and
  `custom`, the only one with a prompt of its own. A scope names ids only (a release, task and issue ids, a version), never a backlog item and never a copy of what a release holds; a
  change of what a release holds changes the releases file in the same commit. A step inserted midway takes a suffix id (`6c`) and never renumbers the others; inserting it is a
  logged decision. The State column is a cache of the repository's state; the log is the record.
- **Running.** The procedure `run-flow`: the decision levels (D0 mechanical to D4 external communication), the hard limits no mode crosses, the step report a worker ends with,
  the unbiased analysis, escalation and the digests. The resume phrases of the profile ("Run flow N") approve what the settings of the named flows allow, within the Git rules of the entry file.
- **The tools.** `harness flow check` (part of `harness check all`, as the check `flows`) holds the parts of a flow and of its log, the step ids (unique, an inserted step with a suffix after the step it follows), that the ids a step names exist (tasks and issues, never a backlog item), that a version is a row of the releases file and one the flow declares, that the `Needs` of steps point to
  earlier steps and those of flows resolve without a circle, and that the flows index agrees with the files. `harness flow status <n>` recomputes the state of each step from the
  repository (the ids of a `tasks` step are ✅ and their pull requests merged, a `cut` has its tag, a `consumer-take` has the version in the consumer's lock), compares it with the State column and with
  the newest entries of the log, and prints the mismatches, a step left open, and the next step. `harness flow next <n>` prints that step with its prompt, and `harness flow prompt <n> <step>` the
  prompt of a step: the standard wording (the header, the text of the kind, the Git wording, where to stop, the step report) is written once in the [step prompts](./flow-step-prompts.md), and a
  `custom` step carries its own text under `## Step <#>` in the flow file. The session start names a flow that is running or waits, with its next step by the State column.
  `harness flow dispatch <n> <step> [--context <percent>] [--account <id>]` says how to hand a step to a worker: its executor (the step's own or the flow's, by the means of the runtime adapter's role `executors`,
  the manual one when the runtime offers none), whether the previous step's worker continues it or a fresh one starts, with every reason, the means to start or continue it, to fetch its full
  report and to read its context, and the executor line of its "step started" log entry, whose `Worker:` and `Account:` fields the next dispatch reads. A worker of another account
  or another executor than the step's is never continued; when a continue fails anyway, `dispatch` has printed the fresh start to fall back on. Beside every start it prints the next
  executor of the order for this step only, with the log line that names it as the fallback and its reason (`cli, the fallback of session: <the reason>`); `harness flow check` refuses a
  "step started" entry on another executor than the step's own without one, so a switch to the command line always shows in the log.
- **Usage** (task 5.6). The runtime adapter's role `usage` says how the account's windows are read (a runtime that reports them gives the 5-hour and the weekly window in whole percent with their
  reset times; where nothing reads them the owner is asked) and carries a table of coefficients: percent of a window per SP by subscription, model family and step kind (money on an API key).
  `harness flow estimate <n>` sizes the steps and the flow by it, so a flow is sized against the weekly window before it starts; the Est. usage column of a step is that figure in percent of the weekly window.
  `harness flow gate <n> <step> --five-hour <percent>@<reset> --weekly <percent>@<reset>` starts nothing: it answers GO when the current use plus the estimate times the safety factor stays under the
  thresholds of every window, WAIT until a reset when a window that would pass is due to reset within `maxWaitMinutes`, STOP when the step cannot fit an empty window (split it when it is planned: `harness flow check` flags
  such a step where the subscription is known) or the reset is too far, and ASK when the use was not read. `harness flow sample <n> <flow-start|step-start|step-end|flow-end> [<step>] …` appends a
  measurement to `usage.jsonl` of the flows folder (tracked, shared by every flow): the windows with their reset times, tokens when the runtime gives them, the model, the SP, the step kind, the subscription and
  whether the worker started cold or warm; at a step's end it also prints what the step used against its estimate. A window that reset between a step's two samples is cut, and counts for nothing.
  The numbers of a table that was not measured are marked `provisional`.
- **Calibration** (task 5.7). `harness flow calibrate [--min <n>] [--subscription <id>]` reads `usage.jsonl`, pairs each step's start and end samples, drops the windows that a reset cut, takes the median
  use per SP of each subscription, model family and step kind (tokens per SP converted to percent per subscription over all the steps together, where the runtime reports tokens: whole percents are coarse on a larger subscription;
  else the percent per SP), and prints the coefficients it proposes beside the table's, with the number of steps behind each (at least 3 by default). It compares the cold and the warm starts by
  their use per SP and says whether warm starts pay off (the median ratio at most 0.9), and sets whole flows against the sum of their steps. It never writes: the procedure `run-flow` says to run it at the end of a flow
  and that a proposal is accepted by a pull request that changes the runtime adapter's table with the comparison, and that `reuse` defaults to `never` when warm starts do not pay off.
- **Repositories** (task 5.8). A flow belongs to its home repository (`home`, where its file lives). Its `repos` setting may name external ones, each a row under an alias that the `Repo` column uses:
  `"app": { "remote": "<owner>/<name>", "role": "consumer", "kinds": ["consumer-take"] }` (`kinds`: the step kinds allowed there, `consumer-take` by default; only `consumer-take` and `custom` run in an external
  repository). The folders on this machine go in the ignored `harness-profile.local.json`, `repos.<alias>` (relative to the project or absolute), because they differ per machine; a flow file never holds one.
  In an external repository the orchestrator **only starts a worker** there (the executor of the runtime adapter, in that folder: `cli` for a step planned for a session, logged as its fallback with the reason; the manual executor when the folder is not set): it edits no file there, the worker's
  prompt sends it to that repository's own entry file and its own approvals, and the authority of a flow over release cuts and reports (the procedures `release` and `triage-reports`) covers the home repository only.
  A step there names the work by what it does ("take `0.2.0-dev.1`"), never by that repository's task ids, which belong to its own plan (`harness flow check` refuses an id). `harness flow status` checks such a step
  through the host's role `remote-state`, without a clone: the lock file the repository holds (a `consumer-take` is done when it names the version) and its pull requests that mention the version (an open one is running).
- **Not yet.** Parallel steps (waves); the `Needs` column keeps room for them.
