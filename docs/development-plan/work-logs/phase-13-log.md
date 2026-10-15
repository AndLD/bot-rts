[← Phase 13 — Observability platform](../phases/phase-13-observability-platform.md)

# Phase 13 — Observability platform — work log

Append-only log used to resume the phase in a new session (AGENTS.md §7.6). Newest entry at the bottom. Add an entry
whenever a session ends or pauses, or a task finishes; commit it in the same pull request as the work.

## Entry template

```markdown
### YYYY-MM-DD — short summary
- **Tasks:** 13.x, 13.y
- **Branch:** `feature/13.x-slug` — done | WIP (what remains, what is uncommitted/unpushed)
- **Decisions / deviations from the plan:** …
- **Problems / blockers / findings:** …
- **Next step:** the exact next action
- **Verify with:** commands that show the current state is healthy
```

## Entries

### 2026-10-15 — phase proposed
- **Tasks:** none started; 13.1 to 13.6 are proposed
- **Branch:** `docs/phase-9-clock-split-and-phase-13` — the plan only
- **Decisions / deviations from the plan:** the owner asked for the logs of every node to be visible in the console, and suggested moving the logging to OpenTelemetry and storing the logs in Elasticsearch. It is too large for Phase 9 (9.10 keeps its per-process buffer), so it is a phase of its own, outside the MVP count, ordered after Phase 9. The task list and the estimates (29 SP) are a draft for the owner's review.
- **Problems / blockers / findings:** none.
- **Next step:** the owner reviews the list; then 13.1 can start.
- **Verify with:** `npm run docs:check`

### 2026-10-15 — tracing built into the phase; draft changed to 35 SP
- **Tasks:** 13.1 to 13.7 (the draft had 13.1 to 13.6); none started
- **Branch:** `docs/phase-13-tracing` — the plan only
- **Decisions / deviations from the plan:** the owner asked that everything that can be connected is connected by tracing. So 13.1 now brings the **tracing core** with the logs: spans for requests, socket events, engine ticks and scheduled jobs, the trace context propagated across the API, the engine thread, the Redis link and the MCP server, and the rule that every record in a request, tick or job path carries a trace id and a span id (a test enforces it). OpenTelemetry itself does not require the ids on a log record; they are filled in only inside a span, which is why the spans and the propagation across our own boundaries are part of the task. 13.4 is new (the trace view in the console), and the decision about metrics moved to 13.6 (exemplars that link a slow request or tick to its trace). The phase is 35 SP; the total of Phases 0–11 is unchanged, since Phase 13 is outside it.
- **Problems / blockers / findings:** none.
- **Next step:** the owner reviews the list; then 13.1 can start.
- **Verify with:** `npm run docs:check`

### 2026-10-15 — decision: a shared collector gateway
- **Tasks:** 13.2 (text only); none started
- **Branch:** `docs/phase-13-gateway` — the plan only
- **Decisions / deviations from the plan:** the owner decided on **one shared OpenTelemetry Collector (gateway) for all nodes**. The apps (each API node, the engine node, the MCP server) only know the OTLP endpoint of the gateway and a bearer token; Elasticsearch is known only to the gateway and to the API's read-only account for the search. Consequences written into 13.2: bounded queues and retries in the SDK exporters (the log files keep every line), a persistent queue on the gateway, optional two replicas behind a load balancer, the gateway's own health as a metric of the dashboard, and the network rule (only the nodes reach the gateway). Tail sampling, which would need the spans of one trace on one replica, is not part of this phase.
- **Problems / blockers / findings:** none.
- **Next step:** unchanged: the owner reviews the list; then 13.1 can start.
- **Verify with:** `npm run docs:check`

### 2026-10-15 — phase approved; the MVP includes it
- **Tasks:** none started
- **Branch:** `docs/mvp-all-phases` — the plan only
- **Decisions / deviations from the plan:** the owner approved the phase as drafted (13.1 to 13.7, 35 SP, with tracing and a shared collector gateway) and asked that the MVP definition include every existing phase. The phase is no longer "proposed", and it and Phase 12 now count in the total: Phases 0–13 are 982 SP, with Phase 12 growing as issues are added.
- **Problems / blockers / findings:** none.
- **Next step:** 13.1 when the phase is reached (after Phase 9).
- **Verify with:** `npm run docs:check`
