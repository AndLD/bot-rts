[← Development plan index](../DEVELOPMENT-PLAN.md)

# Phase 13 — Observability platform (29 SP, proposed)

**Status:** ⬜ Not started · **Branches:** none yet (see the [implementation log](#implementation-log)) · **Work log:** [phase-13-log](./work-logs/phase-13-log.md)

**Proposed 2026-10-15 by the owner and drafted here for review; the task list and the estimates are not final until the owner approves them.**

Moves the logs of the game to **OpenTelemetry** and stores them in **Elasticsearch**, so that the admin console can search the logs of
**every node** (every API node and the engine node), not only of the process that answers (the log search of 9.10 reads a
per-process in-memory buffer). The metrics of 8.3 (Prometheus) stay as they are unless task 13.5 decides otherwise. The phase is an
upgrade of operations, not of the game: it is outside the MVP count of the plan index, and the game works without it.

**Depends on:** Phase 8 (the observability basics, 8.3), 9.10 (the admin logs and audit viewer), and 9.19 (retention from the console,
which the log retention joins). **Order:** after Phase 9; it can be moved by the owner.

| # | Task | SP | Status |
| --- | --- | --- | --- |
| 13.1 | **Logging on OpenTelemetry.** The `Logger` port keeps its shape; behind it the OpenTelemetry Logs SDK replaces log4js in the API, the engine thread (its own application context) and the MCP server. One record schema: service name, node role (`APP_ROLE`), node id, level, message, and as attributes the request id (tied to the trace id when there is one), the user id and the bot id. Records go to the console and the files as now (`LOG_FORMAT`, `LOG_FILE`, for development) and to an OTLP exporter when `OTEL_EXPORTER_OTLP_ENDPOINT` is set. The in-memory `LogBuffer` of 9.10 stays as the fallback. Includes unit tests of the mapping and of the fallback | 5 | ⬜ |
| 13.2 | **Collector and Elasticsearch in Docker.** `docker-compose.yml` gets an OpenTelemetry Collector and a single-node Elasticsearch with pinned versions and health checks; the collector receives OTLP, limits memory, batches, and writes to Elasticsearch; index templates and mappings; an index lifecycle policy whose retention comes from the environment (and later from the console, 13.4); the same containers in CI. `docs/operations/DEPLOYMENT.md` explains sizing, scaling and what happens when Elasticsearch is down (the records wait in the collector and the files keep them) | 5 | ⬜ |
| 13.3 | **`LogStore` port and the Elasticsearch adapter.** A port with `search({ text, level, requestId, userId, botId, node, from, to }, page)`, an Elasticsearch adapter with a read-only account, time limits, a bound on the window and the page, and a clear error when the store is down; the Logs page of the console searches through it, with a node filter and "all nodes", and the answer keeps the shape of 9.10; `LOG_STORE=memory` keeps the old buffer for development. The slow ticks stay with the engine's metrics. Includes integration tests against a real Elasticsearch container, the update of the `authorization-matrix` and of the Cypress spec of the Logs page | 8 | ⬜ |
| 13.4 | **Privacy, access and retention of logs.** Redaction of emails, tokens, passwords and API keys in the SDK and again in the collector, with a test over a corpus of lines; every log search is written to the audit trail (who, what was asked); the retention of the log indices becomes one more setting of 9.19 (the index lifecycle policy is updated through the admin API, with a floor and a reset to the default) | 3 | ⬜ |
| 13.5 | **Metrics and traces: decide, then do what is decided.** A short decision record: keep Prometheus `/metrics` as it is, or export the same numbers through OpenTelemetry; spans for HTTP requests and for the engine's ticks with sampling; where traces would be stored. If the owner approves, the spans of requests and ticks go out over OTLP with the request id as the link to the logs; otherwise the task closes with the record only | 5 | ⬜ |
| 13.6 | **Cutover, cleanup and runbook.** Production images stop writing log files by default, log4js and its file transports are removed, the deployment gate and the README table of environment variables (`OTEL_*`, `LOG_STORE`, `ELASTICSEARCH_URL`) are updated, the pages of the admin documentation about the logs are updated in English and Russian, and a runbook covers the size of the indices, a store that is down, and how to search | 3 | ⬜ |

## Exit criteria

An admin can search the logs of every node from the console, by text, level, request id, user, bot, node and time, with the records
stored in Elasticsearch and sent through OpenTelemetry; personal data is redacted; searching is audited; the retention of the logs is
set from the console; the game and the console still work with `LOG_STORE=memory`; the coverage gate (≥ 97 %) stays green.

## Implementation log

Branches and pull requests that implemented this phase's tasks, added when each one is merged (branch names follow
AGENTS.md §7.1).

| Branch | Tasks | PR | Status |
| --- | --- | --- | --- |
