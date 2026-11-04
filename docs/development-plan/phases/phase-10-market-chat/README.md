[← Development plan index](../../DEVELOPMENT-PLAN.md)

# Phase 10 — Market, currency, chat & transfers (154 SP)

**Status:** ⬜ Not started · **Branches:** none yet (see the [implementation log](#implementation-log)) · **Work log:** [log](./log.md), and a log beside each task (`<id>.log.md`)

The player economy and social layer, specified in design [§26](../../../product-knowledge/game-design/26-market-and-currency.md) and
[§27](../../../product-knowledge/game-design/27-chat-and-transfers.md): in-game credits, a remote market (resource exchange and auctions) behind a
single-class market terminal module, chat, and transfers between players. The phase depends on storage and modules
(Phase 4), the engine commands and event bus (Phase 5), the window manager (Phase 6), notifications and achievements
(Phase 7), API-key scopes (8.9) and the admin foundations (9.1). **Order:** it is developed after Phase 13 (owner decision 2026-10-16, see "Order of development" in the [plan index](../../DEVELOPMENT-PLAN.md)), so the market is built with the tracing, the logs of every node and the metrics history of Phase 13 in place; the market metrics of design §25.5 are delivered here (10.11 and 10.15).

**Dependencies, waves and ownership** (replaces the single chain of the earlier execution order, owner decision 2026-10-18; derived by the
harness review of 2026-10-17, section 10, with 10.16 added). One agent may still work the tasks in the id order that satisfies the
dependencies (10.1, 10.2, 10.3, 10.4, 10.16, 10.5, …); several agents follow the waves ([method §7](../../../../harness/core/method/method.md#7-several-agents)).
Each edge is *e* (stated in a task text) or *i* (inferred from the interfaces the task cites); the agent that starts a task confirms its edges.

| Task | Depends on |
| ---- | ---------- |
| 10.1, 10.3, 10.7 | none |
| 10.2 | 10.1 (*i*: escrow accounts in the ledger) |
| 10.4 | 10.1, 10.2, 10.3 (*i*) |
| 10.16 | 10.1, 10.2, 10.4 (*i*: the system buyer is part of the exchange) |
| 10.5 | 10.1, 10.2, 10.3 (*i*) |
| 10.6 | 10.4, 10.5 (*i*) |
| 10.17 | 10.1, 10.2, 10.3, 10.5 (*i*: editions and auctions are sold from the product page) |
| 10.8 | 10.7 (*i*) |
| 10.9 | 10.1, 10.2, 10.7 (*i*: system cards in the conversation) |
| 10.10, 10.12, 10.13 | 10.4, 10.5, 10.9 (*i*) |
| 10.11 | 10.1, 10.4, 10.5, 10.7 (*i*) |
| 10.15 | 10.10, 10.11 (*e*: "the flags that 10.10 raises") |
| 10.14 | 10.6, 10.8, 10.9, 10.11 (*i*) |

| Wave | Tasks | Lanes (area) | Starts when |
| ---- | ----- | ------------ | ----------- |
| 0 | the contracts: ledger account kinds, the escrow port, the market error codes, the events of design §26.8, the `chat` scope | the orchestrator | the open questions of design §26 and §27 that block a task are decided |
| 1 | 10.1, 10.3, 10.7 | A: wallet and ledger · C: the market terminal module · B: chat backend | wave 0 is merged |
| 2 | 10.2, 10.8 | A: escrow and inbox · B: chat window | 10.1 and 10.7 are merged |
| 3 | 10.4, 10.16, 10.5, 10.9 | A: exchange and system trader · C: auctions · B: transfers | 10.2 and 10.3 are merged |
| 4 | 10.6, 10.17, 10.10, 10.11, 10.12, 10.13 | C: market UI and the script catalog · A: anti-abuse and integrity tests · B: admin moderation and notifications | wave 3 is merged |
| 5 | 10.15, 10.14 | B: analytics · A or C: end-to-end specs | 10.10 and 10.11, and all UI, are merged |

Hotspots (files that several tasks of a wave write): `api/prisma/schema.prisma` and the ordered migrations, the balance configuration and
`api/.env.example` have one owner per wave, lane A, and the others rebase on that owner's change; `api/src/app.module.ts` takes one line
per module (a trivial conflict, accepted); `api/openapi.json` and the generated client are regenerated after a rebase, never merged by hand;
the `lib` contracts (`error-codes.ts`, `interfaces/api-keys.ts`, `socket-events.ts`) are written in wave 0. Records are per task: a log
fragment in `work-logs/phase-10/` and a changelog fragment, so no shared list is edited. Recommended: three agents after wave 0.

<!-- phase-tasks:start -->
| # | Task | Agent | SP | Status |
| - | ---- | ----- | -- | ------ |
| [10.1](./10.1.md) | first | C3 | 13 | ⬜ |
| [10.2](./10.2.md) | Escrow, inbox and delivery (design §26.7): escrow service for goods and credits, per-player inbox… | C3 | 8 | ⬜ |
| [10.3](./10.3.md) | Trade | C2 | 5 | ⬜ |
| [10.4](./10.4.md) | Resource exchange (design §26.4): order books per resource, limit orders and market orders (a mar… | C3 | 13 | ⬜ |
| [10.5](./10.5.md) | Auctions and editions (design §26.5–26.6): auctions for blueprint items and single-copy scripts (… | C3 | 13 | ⬜ |
| [10.6](./10.6.md) | Market UI: market screen in a window (order books and price charts, auction list and detail, my o… | C2 | 13 | ⬜ |
| [10.7](./10.7.md) | Chat backend (design §27.1): channels (`global-en`, `global-ru`) and private messages, Socket.IO … | C2 | 8 | ⬜ |
| [10.8](./10.8.md) | Chat UI: chat window (window manager) with channel list, private conversations, unread counters, … | C2 | 8 | ⬜ |
| [10.9](./10.9.md) | Transfers (design §27.2): `/send` command and Send dialog, credits (instant, caps) and items (off… | C3 | 8 | ⬜ |
| [10.10](./10.10.md) | Anti-abuse and integrity (design §26.9, §27.4): new-account limits; daily limits per player for m… | C3 | 8 | ⬜ |
| [10.11](./10.11.md) | Every admin rule of Phase 9 applies, written here so that it is not forgotten (added 2026-10-15): | C2 | 13 | ⬜ |
| [10.12](./10.12.md) | Notifications and achievements for trading: the Trade notification category, trade and transfer e… | C2 | 5 | ⬜ |
| [10.13](./10.13.md) | Economy integrity tests: property tests that the money supply and item counts are conserved acros… | C3 | 5 | ⬜ |
| [10.14](./10.14.md) | E2E (Cypress): exchange order → fill → inbox → withdraw; auction create → bid → outbid → anti-sni… | C2 | 8 | ⬜ |
| [10.15](./10.15.md) | Market analytics and monitoring in the console | C2 | 5 | ⬜ |
| [10.16](./10.16.md) | System trader | C3 | 8 | ⬜ |
| [10.17](./10.17.md) | Script catalog and product pages | C2 | 13 | ⬜ |
<!-- phase-tasks:end -->

Task status: ⬜ not started · 🟡 in progress (branch noted in the work log) · ✅ done.

**Exit criteria:** players can earn and spend credits, trade resources on the exchange, buy and sell scripts (fixed-price editions or
auctions) from product pages in one script catalog, and blueprints at auction through a market terminal, chat, and send credits and items to each other; the ledger proves the economy conserves
money and goods; admins can moderate trades and chat — covered by unit, integration, property and e2e tests.

## Implementation log

Printed from the merged pull requests: `npm run plan:log -- 10` (every squash commit carries a `Plan: <task id>` line). Each task writes its
own log fragment in `work-logs/phase-10/` (template: `work-logs/_task-template.md`); this file holds no table to edit.
