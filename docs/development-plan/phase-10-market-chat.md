[← Development plan index](../DEVELOPMENT-PLAN.md)

# Phase 10 — Market, currency, chat & transfers (110 SP)

**Status:** ⬜ Not started · **Branches:** none yet (see the [implementation log](#implementation-log)) · **Work log:** [phase-10-log](./work-logs/phase-10-log.md)

The player economy and social layer, specified in design [§26](../game-design/26-market-and-currency.md) and
[§27](../game-design/27-chat-and-transfers.md): in-game credits, a remote market (resource exchange and auctions) behind a
single-class market terminal module, chat, and transfers between players. The phase depends on storage and modules
(Phase 4), the engine commands and event bus (Phase 5), the window manager (Phase 6), notifications and achievements
(Phase 7), API-key scopes (8.9) and the admin foundations (9.1).

**Execution order:** 10.1 → 10.2 → 10.3 → 10.4 → 10.5 → 10.12 → 10.6 → 10.7 → 10.9 → 10.8 → 10.10 → 10.13 → 10.11 → 10.14.

| # | Task | SP | Status |
| --- | --- | --- | --- |
| 10.1 | Currency and wallet (design §26.1): per-user `Wallet`, append-only double-entry ledger written inside the engine transaction, starter grant at base deploy, system buyer with floor prices, fee configuration in the balance config, money-supply invariant, read endpoints | 8 | ⬜ |
| 10.2 | Escrow and inbox (design §26.7): escrow service for goods and credits, per-player inbox, withdraw into base storage or a drive (capacity and quota checks), inbox size limit | 5 | ⬜ |
| 10.3 | Market terminal module (design §26.2): the `marketTerminal` module class and recipe, ops / energy costs, the `market.*` script functions skeleton with the new error codes, the **Trade** manual-control category and its settings switch | 5 | ⬜ |
| 10.4 | Resource exchange (design §26.4): order books per resource, limit and market orders, price-time matching inside the engine tick, partial fills, escrow, cancel and expiry, fees, system buyer bid, price bounds | 13 | ⬜ |
| 10.5 | Auctions (design §26.5–26.6): listings for scripts and blueprint items, bids with escrow and refunds, minimum step, buy-now, anti-sniping extension, cancellation rules, settlement, script editions (exclusive or N copies), fees | 13 | ⬜ |
| 10.6 | Market UI: market screen in a window (order books and price charts, auction list and detail, my orders and bids, wallet, inbox), terminal command `market`, translated strings | 13 | ⬜ |
| 10.7 | Chat backend (design §27.1): channels (`global-en`, `global-ru`) and private messages, Socket.IO namespace, 7-day history, rate limits, block list, reports, mute hooks, `/api/v1` endpoints (scope `chat`) | 8 | ⬜ |
| 10.8 | Chat UI: chat window (window manager) with channel list, private conversations, unread counters, presence, block and report actions, translated strings | 8 | ⬜ |
| 10.9 | Transfers (design §27.2): `/send` command and Send dialog, credits (instant, caps) and items (offer → accept / decline → inbox, expiry and return), system cards in the conversation, `/api/v1` endpoints (scope `trade`) | 8 | ⬜ |
| 10.10 | Anti-abuse and integrity (design §26.9): new-account limits, daily caps, price bands, per-player limits, wash-trading and multi-account heuristics raising admin alerts, ledger reconciliation job | 5 | ⬜ |
| 10.11 | Admin market and chat moderation (design §25): wallets and ledger viewer, money supply and trade-volume charts, cancel listing, freeze wallet, refund, mute player, delete messages, report queue | 8 | ⬜ |
| 10.12 | Notifications and achievements for trading: the Trade notification category, trade and transfer events on the event bus, achievements (First deal, Merchant, Generous) | 3 | ⬜ |
| 10.13 | Economy integrity tests: property tests that the money supply and item counts are conserved across orders, auctions, transfers and failures; matching determinism; no duplicated or lost goods on crash and restart | 5 | ⬜ |
| 10.14 | E2E (Cypress): exchange order → fill → inbox → withdraw; auction create → bid → outbid → anti-snipe → win; script editions; inbox full and capacity limits; chat DM, block and report; transfer offer accept / decline / expiry; new-account limits; admin moderation of a listing and a message | 8 | ⬜ |

Task status: ⬜ not started · 🟡 in progress (branch noted in the work log) · ✅ done.

**Exit criteria:** players can earn and spend credits, trade resources on the exchange, buy and sell scripts and blueprints at
auction through a market terminal, chat, and send credits and items to each other; the ledger proves the economy conserves
money and goods; admins can moderate trades and chat — covered by unit, integration, property and e2e tests.

## Implementation log

Branches and pull requests that implemented this phase's tasks, added when each one is merged (branch names follow
AGENTS.md §7.1).

| Branch | Tasks | PR | Status |
| --- | --- | --- | --- |
| _none yet_ | | | |
