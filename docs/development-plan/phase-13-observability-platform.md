[← Development plan index](../DEVELOPMENT-PLAN.md)

# Phase 13 — Observability platform (35 SP, proposed)

**Status:** ⬜ Not started · **Branches:** none yet (see the [implementation log](#implementation-log)) · **Work log:** [phase-13-log](./work-logs/phase-13-log.md)

**Proposed 2026-10-15 by the owner and drafted here for review; the task list and the estimates are not final until the owner approves them.**

Moves the logs of the game to **OpenTelemetry**, adds **tracing** so that everything that can be connected is connected by a trace id (the owner's wish: every log record carries one, and a request can be followed over the browser's call, the API, the engine and the notifications it causes), and stores both in **Elasticsearch**, so that the admin console can search the logs of
**every node** (every API node and the engine node), not only of the process that answers (the log search of 9.10 reads a
per-process in-memory buffer). The metrics of 8.3 (Prometheus) stay as they are unless task 13.6 decides otherwise. The phase is an
upgrade of operations, not of the game: it is outside the MVP count of the plan index, and the game works without it.

**Depends on:** Phase 8 (the observability basics, 8.3), 9.10 (the admin logs and audit viewer), 9.17 (the engine's own setting channel, whose request pattern the trace propagation follows) is useful but not required, and 9.19 (retention from the console,
which the log retention joins). **Order:** after Phase 9; it can be moved by the owner.

| # | Task | SP | Status |
| --- | --- | --- | --- |
| 13.1 | **Logs and traces on OpenTelemetry (the core).** The `Logger` port keeps its shape; behind it the OpenTelemetry Logs SDK replaces log4js in the API, the engine thread (its own application context) and the MCP server, and the Tracing SDK is added next to it so that **every log record carries a trace id and a span id**. Spans: every HTTP request (the W3C `traceparent` header is read from the caller or the load balancer, a new trace starts otherwise, and the trace id is returned in the response headers and replaces the request id of 8.3, which stays as an alias), every Socket.IO event, every tick of the engine (with child spans for the world actions and the manual calls it applies), every scheduled job (the lifecycle pass, the monitoring sample, the write-behind flush), and the start and the end of a script execution (a long script is a span **link**, not a parent). The trace context is **propagated across our own boundaries**: in the messages between the API and the engine thread, over the Redis link of a scaled deployment, from the engine's events to the notifications they cause, and from the MCP server to the API. A record written outside any span in a request, tick or job path is a defect: a test fails on it. Sampling is parent-based with a ratio from the environment; a sampled-out span still has its ids, so the logs keep them. Records go to the console and the files as now (`LOG_FORMAT`, `LOG_FILE`, for development) and to OTLP when `OTEL_EXPORTER_OTLP_ENDPOINT` is set; the `LogBuffer` of 9.10 stays as the fallback. Includes unit tests of the mapping, of the propagation on every link (worker, Redis, disabled) and of the "no record without a span" rule | 8 | ⬜ |
| 13.2 | **Collector and Elasticsearch in Docker.** `docker-compose.yml` gets an OpenTelemetry Collector and a single-node Elasticsearch with pinned versions and health checks; the collector receives OTLP (logs and traces), limits memory, batches, and writes both to Elasticsearch; index templates and mappings (the trace id and the span id are keyword fields); an index lifecycle policy whose retention comes from the environment (and later from the console, 13.5); the same containers in CI. `docs/operations/DEPLOYMENT.md` explains sizing, scaling and what happens when Elasticsearch is down (the records wait in the collector and the files keep them) | 5 | ⬜ |
| 13.3 | **`LogStore` port and the Elasticsearch adapter.** A port with `search({ text, level, requestId, traceId, userId, botId, node, from, to }, page)`, an Elasticsearch adapter with a read-only account, time limits, a bound on the window and the page, and a clear error when the store is down; the Logs page of the console searches through it, with a node filter, "all nodes" and a trace id filter, and the answer keeps the shape of 9.10; `LOG_STORE=memory` keeps the old buffer for development. The slow ticks stay with the engine's metrics. Includes integration tests against a real Elasticsearch container, the update of the `authorization-matrix` and of the Cypress spec of the Logs page | 8 | ⬜ |
| 13.4 | **Traces in the console.** A line of the log shows its trace id with an **Open trace** action, which shows the trace: its spans as a timeline (name, node, start, duration, status) and **every log of the trace from every node** in order, so one request can be followed from the browser's call through the API, the engine's tick and the notification it caused. Search by trace id (and by the request id of the old logs). A `TraceStore` port with the Elasticsearch adapter next to the `LogStore`; the permission is `logs.read` and the read of a trace is audited. Includes tests (an integration test that follows a request over the API and the engine in the store) and a Cypress spec | 5 | ⬜ |
| 13.5 | **Privacy, access and retention.** Redaction of emails, tokens, passwords and API keys in the SDK and again in the collector, for the attributes of the spans as well as for the logs, with a test over a corpus of lines; every log search and trace read is written to the audit trail (who, what was asked); the retention of the log and trace indices becomes one more setting of 9.19 (the index lifecycle policy is updated through the admin API, with a floor and a reset to the default) | 3 | ⬜ |
| 13.6 | **Metrics: decide, then do what is decided.** A short decision record: keep Prometheus `/metrics` as it is (the default), and whether to add exemplars (the trace id of a slow request or tick on the histogram) or to export the same numbers through OpenTelemetry so that a spike in a chart on the dashboard links to the traces behind it. If the owner approves, it is done and the dashboard of 9.3 links to the trace; otherwise the task closes with the record only | 3 | ⬜ |
| 13.7 | **Cutover, cleanup and runbook.** Production images stop writing log files by default, log4js and its file transports are removed, the deployment gate and the README table of environment variables (`OTEL_*`, `LOG_STORE`, `ELASTICSEARCH_URL`) are updated, the pages of the admin documentation about the logs and the traces are updated in English and Russian, and a runbook covers the size of the indices, a store that is down, and how to follow one request | 3 | ⬜ |

## Exit criteria

An admin can search the logs of every node from the console, by text, level, trace id, request id, user, bot, node and time, with the records
stored in Elasticsearch and sent through OpenTelemetry; every record of a request, a tick or a job carries a trace id, and a trace can be opened with its spans and the logs of all nodes; personal data is redacted; searching is audited; the retention of the logs is
set from the console; the game and the console still work with `LOG_STORE=memory`; the coverage gate (≥ 97 %) stays green.

## Implementation log

Branches and pull requests that implemented this phase's tasks, added when each one is merged (branch names follow
AGENTS.md §7.1).

| Branch | Tasks | PR | Status |
| --- | --- | --- | --- |
