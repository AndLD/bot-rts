[← Development plan index](../DEVELOPMENT-PLAN.md)

# Risk register

| Risk                                                          | Likelihood | Impact | Mitigation                                                        |
| ------------------------------------------------------------- | ---------- | ------ | ----------------------------------------------------------------- |
| Script engine is unsafe / exploitable                         | High       | High   | QuickJS (WASM) sandbox behind a `ScriptRuntime` interface, strict API allowlist, memory/stack limits, interrupt-handler deadlines, escape tests |
| Scheduler unfairness or starvation under load                 | High       | High   | Design RFC first; round-robin queue; load tests; tune budgets     |
| Race conditions on shared map cells/resources                 | High       | High   | Single-writer engine: collect-then-apply with deterministic order, no concurrent world writers (API requests go through engine commands) |
| Refactor breaks working vertical slice                        | Medium     | Medium | Small behavior-preserving PRs; repository integration tests (1.1a) and safety-net tests (1.9)           |
| Coverage gate blocks delivery (the gate is aggressive)        | Medium     | Medium | Automated coverage in CI; targeted `istanbul ignore` only with justification |
| Docker PostgreSQL / Cypress CI flakiness                      | Medium     | Medium | Pin image and versions, isolated database per Jest worker, retry policy in CI |
| Single maintainer/agent context loss across phases            | Medium     | Low    | Docs (`AGENTS.md`, this plan) + Conventional Commits + small PRs  |
| Engine thread becomes the capacity ceiling (one process owns the world) | Medium | High | Per-bot limits, tick-overrun guard, metrics from day one, benchmark spike in task 5.1, pool-ready script-runtime boundary |
| Next.js migration: React 19 / Ant Design / CodeMirror compatibility | Medium | Medium | Compatibility spike first in task 1.18; pin versions; migrate while the client is small |
| NestJS + clean-architecture migration breaks the working slice | Medium | Medium | Safety-net tests (task 1.9) before the migration, strangler approach (legacy routers hosted in Nest), small PRs |
| Third-party clients / AI players abuse the public API | Medium | Medium | Same game rules and budgets for every client, scoped and revocable API keys, per-key rate limits, hashed key storage |
| UI scope (Phases 6–7: map, animations, landing, achievements, notifications, i18n) overruns | Medium | Medium | Phase 6 / 7 split, animations and ambient scene are cosmetic and can ship last, tasks sized individually |
| Frontend on Vercel, API/engine elsewhere (cookies, CORS, WebSockets) | Low | Medium | Shared registrable domain, cookie-domain and CORS test in task 8.12, Socket.IO direct to the API domain |
| PostgreSQL + Prisma switch: schema design, and the engine's batched flush through Prisma | Medium | Medium | Persistence behind ports (AGENTS.md §3.4); `createMany`/raw SQL inside the adapter for the flush; load test in 8.6; expand/contract migrations |
