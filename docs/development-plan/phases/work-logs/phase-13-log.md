[← Phase 13 — Observability platform](../phase-13-observability-platform.md)

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

### 2026-10-16 — decisions for 13.6 and for the metrics history
- **Tasks:** 13.6 (the decision part); none started
- **Branch:** `docs/metrics-storage-decision` — the plan and the design only
- **Decisions / deviations from the plan:** the owner decided on the points of the decision record of 13.6. **(1)** Prometheus and Grafana are **not used now**; the `/metrics` endpoint stays unchanged and is not used by the console (kept for external tools). The question, with the reasons to adopt it later and how to switch, is recorded in the backlog of design §25.6. **(2)** Metrics are **not exported through OpenTelemetry**. **(3)** The metrics history is stored in **PostgreSQL**, multi-node-ready: every node writes its 1-minute tier with a `node` column and histogram buckets, behind a history port (design §25.5). **(4)** Trace links from the charts are made inside the console's own series (the trace id of the slowest tick and request per bucket, opened through 13.4), not with Prometheus exemplars. **Not yet in the plan:** the task that persists the metrics history and the extra metrics of design §25.5 is **proposed** (about 5 SP, in this phase or in Phase 12) and waits for the owner's approval; the phase size and the totals are unchanged until then.
- **Problems / blockers / findings:** the history of design §25.5 is in process memory today (`api/src/monitoring/application/metric-history.ts`), so with several API nodes the console shows only the node that answers; the log search of 9.10 has the same limit, which 13.3 removes.
- **Next step:** the owner approves or changes the proposed persistence task; then 13.1 when the phase is reached.
- **Verify with:** `npm run docs:check`

### 2026-10-16 — task 13.8 added; Phase 13 is 40 SP
- **Tasks:** 13.8 (new, 5 SP), 13.6 (text changed); none started
- **Branch:** `docs/metrics-storage-decision` — the plan and the design only
- **Decisions / deviations from the plan:** the owner approved the persistence task proposed in the entry above. **13.8** persists the metrics history in PostgreSQL, multi-node-ready (design §25.5), with the cheap missing metrics. **13.6** is no longer an open decision: its text now states the decision and its work is the trace links from the dashboard charts, which need 13.4 and 13.8. The phase becomes 40 SP, the total of Phases 0–13 becomes 992 SP. 13.8 does not depend on OpenTelemetry, so it can run in parallel with 13.1 to 13.5.
- **Problems / blockers / findings:** none.
- **Next step:** 13.1 when the phase is reached (after Phase 9).
- **Verify with:** `npm run docs:check`

### 2026-10-16 — 13.8 covers all missing metrics; the phase is 48 SP; Phase 13 comes before Phase 10
- **Tasks:** 13.8 (extended, 5 → 13 SP); none started
- **Branch:** `docs/phase-13-before-10` — the plan and the design only
- **Decisions / deviations from the plan:** the owner asked that **all** metrics of design §25.5 that are still missing are collected by 13.8, except the Market row, which comes with Phase 10. So 13.8 now covers the engine and world, scripts, API and sockets, database, jobs and notifications, and infrastructure metrics, besides the persistence. It is re-estimated at **13 SP** (the largest task; the task text suggests how to split it when it starts). Phase 13 is **48 SP** and the total of Phases 0–13 is **1000 SP**. The owner also decided that Phase 13 is **developed before Phase 10**; the plan index (order of development) and the Phase 10 file say so.
- **Problems / blockers / findings:** the estimate of 13.8 is the largest uncertainty of the phase; it is re-estimated when the task starts.
- **Next step:** 13.1 when the phase is reached (after Phase 9, before Phase 10).
- **Verify with:** `npm run docs:check`

### 2026-10-16 — task 13.1 built: logs and traces on OpenTelemetry
- **Tasks:** 13.1 (✅ when its pull request is merged); the phase is 🟡
- **Branch:** `feature/13.1-otel-logs-traces` — done, pull request open
- **Decisions / deviations from the plan:**
  - **Port first.** The application layer owns a `Tracing` port (`shared/application/tracing.ts`: `startSpan`, `withSpan`, `current`, `traceparent`, and `runJob` for scheduled jobs); `NO_TRACING` is the null object that keeps unit tests of classes that only pass the context on free of it. The adapter (`OtelTracing`, `Telemetry`) is in `shared/infrastructure`; a context crosses a boundary only as a W3C `traceparent` string (`lib/utils/trace-context.ts`, shared with the MCP server).
  - **Logs.** log4js is gone (code and dependency). `TelemetryLogger` writes each record to the sinks of the process (console, file as before with `LOG_FORMAT`/`LOG_FILE`, OTLP when `OTEL_EXPORTER_OTLP_ENDPOINT` is set) stamped with the trace id and span id of the active span; the `RecordingLogger` and the `LogBuffer` of 9.10 stay as they were. The settings live in `config.observability` (`OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_EXPORTER_OTLP_HEADERS`, `OTEL_TRACES_SAMPLER_ARG`, `OTEL_EXPORT_QUEUE_SIZE`), so the engine thread gets them through its `workerData` and builds its own `Telemetry` (service `botrts-engine`, next to `botrts-api`). The engine thread flushes its exporters before it says `stopped`.
  - **Spans.** HTTP request (server span from the caller's `traceparent`, named after the route; response headers `X-Trace-Id`, `traceresponse`, and `X-Request-Id`, which is the trace id unless the caller sent an acceptable id, kept as the alias); Socket.IO event (a `socket.use` middleware in the adapter; ends at the acknowledgement, or after the handler's first turn when there is none); engine tick (a root span per tick); every request served in the inbox (the span continues the caller's trace, although the tick that drains the inbox is another trace); a manual call applied in the trace of its request; the write-behind flush; a script execution (a root span in a trace of its own, **linked** to the start request, ended with the script); every scheduled job (lifecycle pass, monitoring sample, achievements flush, ban sweep, notification delivery and purge, game-time refresh).
  - **Propagation.** `traceparent` travels in the thread messages (`RequestMessage`, event messages), in the Redis link (`LinkRequest`), from an engine event to the listeners that react to it (a consumer span), and from the MCP server to the API (a span per tool call with a span per API call under it; the MCP logger writes to the standard error because stdout is the stdio protocol). Each round trip over the thread link and over Redis has a client span on the API side and a server span on the engine side.
  - **The rule "no record without a span".** `tracing.int.test.ts` runs the real application (engine thread included) and fails when a record written during requests and during the monitoring job has no trace id. Records of the start-up of the process, before any request, tick or job exists, are outside the rule.
  - **Sampling** is parent-based with the ratio from the environment; a sampled-out span still has ids (tested), so its logs keep them.
- **Problems / blockers / findings:**
  - The OTLP exporters load Node's HTTP modules with a dynamic `import()`, which Jest's CommonJS runtime refuses. Unit tests replace the exporters; the real export over HTTP was checked once by hand (a ts-node script against a local HTTP server: both signals arrive with the bearer token and the trace id), and the integration test lets the engine thread, which is not under Jest, export to a gateway of the test. Task 13.2 adds the collector container to the integration tests.
  - The exporters' queue drops the newest records when it is full (the SDK's behaviour); "drop the oldest first" in 13.2 would need a custom processor. The log files keep every line either way.
  - The batch delay of the exporters is the SDK default (5 s), so the integration test waits for it.
- **Next step:** 13.2 (collector gateway and Elasticsearch in Docker), then 13.3, 13.4, 13.5, 13.8, 13.6, 13.7.
- **Verify with:** `npm run lint && npm run typecheck && npm run check:boundaries && npm run docs:check`, `npm run test:coverage -w api -w mcp`, `npm test -w api -- --selectProjects integration --testPathPattern src/tracing.int` (needs `npm run db:up`)

### 2026-10-16 — task 13.1 merged; task 13.2 built: the gateway collector and Elasticsearch
- **Tasks:** 13.1 (✅, merged as #190), 13.2 (✅ when its pull request is merged)
- **Branch:** `feature/13.2-collector-gateway-elasticsearch` — done, pull request open
- **Decisions / deviations from the plan:**
  - **Files.** `deploy/observability/otel-collector.yaml` (the gateway) and `deploy/observability/elasticsearch/` (retention policy, templates, `init.sh`); `docker-compose.yml` gets `elasticsearch`, `elasticsearch-init` and `otel-collector` under the profiles `observability` (`npm run obs:up`) and `stack`, pinned to `docker.elastic.co/elasticsearch/elasticsearch:8.15.3` and `otel/opentelemetry-collector-contrib:0.120.0`. CI starts the same containers before the tests and sets `REQUIRE_OBSERVABILITY`.
  - **Gateway.** OTLP/HTTP on `4318` with a bearer token (`bearertokenauth`; 401 without it), `memory_limiter`, `batch`, and the `elasticsearch` exporter in `ecs` mapping mode with a persistent queue (`file_storage`) and retries. The nodes need only `OTEL_EXPORTER_OTLP_ENDPOINT` and the token in `OTEL_EXPORTER_OTLP_HEADERS`.
  - **The persistent queue only works with the exporter's `batcher` on.** I tested an outage by hand: with the default asynchronous bulk indexer the gateway acknowledged a record, Elasticsearch was down, and the record was lost on restart. With `batcher: enabled` the bulk request is synchronous, a failed one stays in the queue on disk, and a record sent during an Elasticsearch outage arrived after the gateway restarted. The same hand test is not in the suite (it needs `docker stop`); the suite checks the token, the documents, the mappings and the policy.
  - **Mapping.** ECS mode writes logs as `trace.id`, `span.id`, `service.name`, `log.level`, `botrts.request_id` and spans as `TraceId`, `SpanId`, `ParentSpanId`, `Name`, `Duration` (different styles for the two signals; 13.3 and 13.4 read them as they are). The `otel` mapping mode needs the built-in OTel templates of Elasticsearch 8.16+. The templates are data streams (`botrts-logs`, `botrts-traces`) with those ids as `keyword`; the policy rolls over daily and deletes after `LOG_RETENTION_DAYS` (default 14).
  - **Dashboard.** `RuntimeMetricsPort` reads the gateway through a `GatewayProbe` port (`HttpGatewayProbe`: health-check URL and the Prometheus text of the gateway, `otelcol_exporter_queue_size` summed): the new metrics `infrastructure.gatewayUp` (warning below 1) and `infrastructure.gatewayQueueSize` (warning above 5,000, red above 9,000), shown as a chart only when a gateway is configured (`OTEL_GATEWAY_HEALTH_URL`, `OTEL_GATEWAY_METRICS_URL`). `npm run docs:generate` updated the thresholds table of the admin documentation. The queue size counts waiting batches; a batch that is being retried is in flight, not counted, so a long Elasticsearch outage shows the gateway as up with a small queue.
  - **Not done here:** two gateway replicas behind a load balancer and TLS are described in `DEPLOYMENT.md` but not built (no deployment target yet); redaction in the collector is 13.5; the read-only Elasticsearch account is 13.3; the development compose file runs Elasticsearch with security off.
- **Problems / blockers / findings:**
  - `docker compose up` does not recreate a container when only a bind-mounted file changed; use `--force-recreate` when testing a collector config (this hid the effect of the bulk flush interval for a while).
  - The collector image runs as a non-root user and could not create the queue directory on a fresh volume; the compose file runs it as root for development. A deployment should chown the volume instead.
  - Searchable delay: with the batcher on, `flush_timeout` is 5 s, so a record is searchable in about 7 s.
- **Next step:** 13.3 (the `LogStore` port and the Elasticsearch adapter, with a read-only account).
- **Verify with:** `npm run obs:up`, then `npm test -w api -- --selectProjects integration --testPathPattern src/observability.int`; `npm run lint && npm run typecheck && npm run check:boundaries && npm run i18n:check && npm run docs:check`

### 2026-10-16 — task 13.3 built: the `LogStore` port and the Elasticsearch adapter
- **Tasks:** 13.3 (✅ when its pull request is merged; stacked on 13.2)
- **Branch:** `feature/13.3-log-store` — done, pull request open
- **Decisions / deviations from the plan:**
  - **Port.** `LogStore` (`logs/application/log-store.ts`): `search(query, {limit, offset})` and `nodes()`; the query has text, level, request id, trace id, player id, bot id, node and time. Two adapters: `MemoryLogStore` over the `LogBuffer` of 9.10 (`LOG_STORE=memory`, the default; the buffer lines now carry the trace id, and `LogBuffer.search` pages with an offset) and `ElasticsearchLogStore` (`LOG_STORE=elasticsearch`, `ELASTICSEARCH_URL`, an API key or a user and password, `LOG_INDEX`).
  - **Limits.** A search covers at most `LOG_SEARCH_MAX_WINDOW_DAYS` (default 7; 400 beyond; the default range is the last 24 h), a page of at most 500 lines within the first 10,000 (the window of Elasticsearch), and `LOG_SEARCH_TIMEOUT_MS` (5 s). A store that is down, refuses or is slow answers `503 LOG_STORE_UNAVAILABLE` (a new error code, translated in English and Russian); an index that does not exist yet means no lines.
  - **Shape.** `GET /admin/logs` keeps the shape of 9.10 and adds `traceId`, `node`, `service` to a line, `store` to the page, `offset` and the new filters to the query; `capacity` is `null` for Elasticsearch. New `GET /admin/logs/nodes` (`logs.read`) for the node filter; the authorization matrix reads it from the OpenAPI document, so it is covered without a hand-written entry. The "node" is `host:pid` (`service.instance.id`), so the API thread and the engine thread of one process share it and differ in the service.
  - **Matching.** Words are matched as whole tokens or ids (`match_phrase`), not as fragments, which is a change from the substring search of the memory store; the player and bot filters are phrases in the message because the lines carry no structured user or bot field. Documented in `DEPLOYMENT.md`.
  - **Console.** The Logs page has filters for trace id, player, bot and node (from the nodes list), shows node, service and trace id per line, says where the lines come from, and loads older lines 100 at a time up to 500. The "Open trace" action is 13.4. English and Russian strings, the admin documentation text, the Cypress spec (`admin.cy.ts`, run locally: 16 passing) and the matrix are updated.
  - **Tests.** Unit: both stores (the Elasticsearch one with a fake `fetch`: filters, window and page limits, account headers, 404, down, slow), the service, the module factory, the config. Integration: `logs.int.test.ts` (memory) and `logs.elasticsearch.int.test.ts` against the real container: lines written straight into the data stream, read back through the API by trace, text, level, player, bot, node, time and page; the window limit; the 503 with a closed port.
- **Problems / blockers / findings:** the Elasticsearch data survives between runs, so the integration test makes its ids unique per run. Searches are not audited yet (13.5).
- **Next step:** 13.4 (traces in the console: the `TraceStore`, the trace view and "Open trace").
- **Verify with:** `npm run obs:up`, then `npm test -w api -- --selectProjects integration --testPathPattern src/logs/`; `npm run lint && npm run typecheck && npm run check:boundaries && npm run i18n:check && npm run docs:check`

### 2026-10-16 — task 13.4 built: traces in the console
- **Tasks:** 13.4 (✅ when its pull request is merged; stacked on 13.3, which is stacked on 13.2)
- **Branch:** `feature/13.4-traces-in-console` — done, pull request open
- **Decisions / deviations from the plan:**
  - **Port.** `TraceStore` (`logs/application/trace-store.ts`): the spans of a trace. `ElasticsearchTraceStore` reads `TRACE_INDEX` (default `botrts-traces`) through the same read-only `ElasticsearchClient` as the log store (extracted from the log store in this task, with its tests); `MemoryTraceStore` has no spans, because the process keeps none. `TracesService` joins the spans with `LogStore.search({ traceId })`, looked for from a minute before the first span to a minute after the last, up to 500 lines, oldest first (`isLogCut` when there are more).
  - **Endpoint.** `GET /api/v1/admin/traces/:id` (`logs.read`, audited as `logs.read-trace` with the trace id as target, on success and on failure). The id is a trace id or, for older lines, a request id, resolved through the log; 404 when there are neither spans nor lines. The authorization matrix reads the route from OpenAPI. The admin reference of the audited actions was regenerated.
  - **Console.** An **Open trace** link next to the trace id of each line and a box to open a trace by its id; a drawer shows the spans as a tree (parent before children, indented) with node and service, start, duration, status and a timeline bar, and the lines of the trace by every node. A store without spans, a trace that sampling left out and a cut list each say so. English and Russian strings; the layout of the tree is a pure function with its own tests.
  - **Tests.** Unit: both stores, the service, the module factory, the layout. Integration: `traces.int.test.ts` (memory store: lookup by trace id and by request id, 404, 400, the audit entry, the permission) and `traces.elasticsearch.int.test.ts`, which follows a request over two nodes: two processes with the real SDK (`botrts-api` and `botrts-engine`, the second continuing the first's `traceparent`) send through the gateway into Elasticsearch, and the console reads back four spans (the engine under the API) and the two lines in order. Cypress: `admin.cy.ts` opens the trace of a line and checks the audit entry.
- **Problems / blockers / findings:**
  - The tracing integration test of 13.1 follows a request over the real API and the engine thread but reads the spans from memory and from a fake gateway, because the API process of a Jest test cannot export over OTLP (the exporters use a dynamic `import()`); the two-process test above closes the loop through the real gateway and store.
  - The emitter helper (`tests/integration/emit-telemetry.ts`, `gateway.ts`) is shared by the observability tests.
- **Next step:** 13.5 (privacy, access and retention: redaction in the SDK and the collector, audit of searches, retention as a console setting).
- **Verify with:** `npm run obs:up`, then `npm test -w api -- --selectProjects integration --testPathPattern src/logs/`; `npx jest src/features/admin/logs -w client`; `npm run lint && npm run typecheck && npm run check:boundaries && npm run i18n:check && npm run docs:check`

### 2026-10-16 — task 13.5 built: privacy, access and retention
- **Tasks:** 13.5 (✅ when its pull request is merged; stacked on 13.4)
- **Branch:** `feature/13.5-privacy-access-retention` — done, pull request open
- **Decisions / deviations from the plan:**
  - **Redaction.** `lib/utils/redaction.ts` (pure, shared by the API, the engine and the MCP server): JWTs, `Bearer`/`Basic` credentials, `botrts_…` API keys, `password`/`secret`/`token`/`api key`/`cookie`/`refresh`/`credentials` values (as `name=value`, `name: value`, JSON or quoted) and emails. It runs in `TelemetryLogger` (before any sink: console, file, OTLP), in `RecordingLogger` (the memory buffer the console reads), in the spans (names, attribute values, failure messages) and in the MCP server. Ids, trace ids and request ids are kept. A corpus test (`redaction.test.ts`) lists 15 lines that must come out clean and 7 that must not change.
  - **Gateway.** A `transform/redact` processor (OTTL) in front of the batcher for logs (body and attributes) and spans (name, status message, attributes, event attributes) applies the same patterns again, without the look-ahead that RE2 does not have (`authorization` is not a secret name there, and `Bearer` is handled by its own rule). `redaction.int.test.ts` posts raw OTLP with secrets, bypassing the SDK, and finds none of them in Elasticsearch.
  - **Audit.** `GET /admin/logs` is `@Audited` as `logs.search` with the filters that were asked in `after` (never the lines found); trace reads were audited in 13.4. Requests refused by validation write nothing, because they never reach the handler.
  - **Retention.** A new retention job `logs` (`days`, 1 to 365, no switch) in the Operations page and its API, defaulting to `LOG_RETENTION_DAYS` (14). Saving or resetting it first sets the `botrts-retention` lifecycle policy in Elasticsearch through a `LogRetention` port (`ElasticsearchLogRetention`, with an account of its own, `ELASTICSEARCH_ADMIN_*`, which only needs `manage_ilm`): if the store cannot take the change nothing is saved (`503 LOG_STORE_UNAVAILABLE`). Without that account, or with `LOG_STORE=memory`, the value is kept and nothing is applied (documented). The Elasticsearch client gained `put`.
  - **Tests.** Unit: the corpus, the logger, the buffer, the spans and the MCP server redact; the retention service applies before saving, only on change, not on failure, and on reset; the adapter and the factory. Integration against the real store: the policy changes and is reset (`retention.elasticsearch.int.test.ts`), a store that is down saves nothing, the gateway redacts, searches are audited.
- **Problems / blockers / findings:** OTTL string literals need `\"` for quotes in a regex, and `${1}` must be written `$$1` in the collector configuration (otherwise the config loader reads it as an environment variable); the redaction processor cannot see a secret that is split over two attributes.
- **Next step:** 13.8 (persist the metrics history, multi-node, and the missing metrics); the phase's order is 13.8 → 13.6 → 13.7.
- **Verify with:** `npm run obs:up`, then `npm test -w api -- --selectProjects integration --testPathPattern 'redaction|retention|src/logs/'`; `npm run lint && npm run typecheck && npm run check:boundaries && npm run i18n:check && npm run docs:check`
### 2026-10-16 — task 13.8 (a) built: the metrics history in the database
- **Tasks:** 13.8 part (a); (b) to (d) and (e) to (g) are next (the split the task text suggested)
- **Branch:** `feature/13.8a-metrics-history` — done, pull request open; branched from `develop` after 13.2, independent of 13.3 to 13.5
- **Decisions / deviations from the plan:**
  - **Port and two implementations.** `MetricHistoryStore` (`record`, `series({metric, from, to, node?})`, `nodes`, `retune`, `flush`). `MemoryMetricHistoryStore` wraps the old two-tier `MetricHistory` (this node only; the default for tests and for one node outside production). `PersistentMetricHistoryStore` keeps the 10-second tier in memory as the live view of the node and writes a row per node, minute and metric to the repository (`MetricHistoryRepository` port, `PrismaMetricHistoryRepository`) when the minute is over, in one batch, idempotently (`createMany … skipDuplicates`); a failed write is kept and tried again with the next minute (at most 120 minutes). Chosen with `MONITORING_HISTORY` (`postgres` by default in production and with `APP_ROLE` other than `all`).
  - **Tables.** `metric_minutes (node, minute, metric, sum, count)` and `histogram_minutes (node, minute, histogram, counts int[], slowest_ms, slowest_trace_id)`, migration `20261016120000_metric_history`. Sum and count (not an average) so that nodes and minutes merge with the right weights.
  - **Percentiles from buckets.** Two distributions: `api.latencyMs` (the bounds of `HttpMetrics`) and `engine.tickMs` (new `TICK_BOUNDS_MS` in `EngineMetrics`; a test holds the two lists equal to the ones of the monitoring domain). `RuntimeMetricsPort` turns two readings into per-sample counts; the persisted `api.latencyP95Ms` and `engine.tickP95Ms` are computed at read time from the merged buckets of the nodes (`percentileOf`), falling back to the averaged values when no distribution was kept. The merge is tested with a quick and a slow node, where the average of the two percentiles would be wrong for both.
  - **Slowest trace per minute.** The request logger passes the trace id to `HttpMetrics`, which keeps the slowest request until the sampler takes it; the engine keeps the slowest tick of each block of 100 ticks with the trace of the tick (the last 12 blocks travel in the metrics snapshot), and the port takes the blocks since its previous reading. Per minute the slowest of these is stored; 13.6 reads it for **Open trace**.
  - **Reading.** `GET /admin/monitoring/series` takes `node`; new `GET /admin/monitoring/nodes?range=`. Without a node the console reads the database (steps of 1 min up to 6 h, 5 min up to a day, 30 min up to a week, 2 h beyond); with this node's own id and a range its memory covers, it reads the 10-second tier. The dashboard has a node selector. A minute is written when it is over, so a chart in the database is up to a minute behind.
  - **Retention and cleanup.** The "coarse series" setting of 9.19 (7 to 365 days) now governs the rows; a new step "monitoring history" of the lifecycle job deletes the older ones and reports `monitoringHistoryDeleted`. The step has no switch (the lifecycle switch governs it).
- **Problems / blockers / findings:** `shared/infrastructure/node-id.ts` is the same file as in 13.3 (identical content, so the two branches merge without a conflict); the test database `TABLES` reset list had to learn the two new tables; `tests/fakes/metric-history.ts` is an in-memory repository that groups the way the SQL does.
- **Not done:** (b) to (g) — the engine, script, API, database, job and infrastructure metrics; alert thresholds for them; the admin documentation page of the metrics. The charts of the percentiles p50 and p99 use the same buckets and need only catalog entries.
- **Next step:** 13.8 (b) to (d): the engine and world, script and API/socket metrics, in the catalog and in the port, on top of this history.
- **Verify with:** `npm run db:up && npm run db:migrate -w api`, `npm test -w api -- --selectProjects integration --testPathPattern 'prisma-metric-history|monitoring.int|prisma-lifecycle'`; `npm run lint && npm run typecheck && npm run check:boundaries && npm run i18n:check && npm run docs:check`
