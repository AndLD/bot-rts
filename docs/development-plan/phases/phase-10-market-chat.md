[← Development plan index](../DEVELOPMENT-PLAN.md)

# Phase 10 — Market, currency, chat & transfers (115 SP)

**Status:** ⬜ Not started · **Branches:** none yet (see the [implementation log](#implementation-log)) · **Work log:** [phase-10-log](./work-logs/phase-10-log.md)

The player economy and social layer, specified in design [§26](../../product-knowledge/game-design/26-market-and-currency.md) and
[§27](../../product-knowledge/game-design/27-chat-and-transfers.md): in-game credits, a remote market (resource exchange and auctions) behind a
single-class market terminal module, chat, and transfers between players. The phase depends on storage and modules
(Phase 4), the engine commands and event bus (Phase 5), the window manager (Phase 6), notifications and achievements
(Phase 7), API-key scopes (8.9) and the admin foundations (9.1).

**Execution order:** 10.1 → 10.2 → 10.3 → 10.4 → 10.5 → 10.12 → 10.6 → 10.7 → 10.9 → 10.8 → 10.10 → 10.13 → 10.11 → 10.15 → 10.14.

| # | Task | SP | Status |
| --- | --- | --- | --- |
| 10.1 | Currency and wallet (design §26.1): per-user `Wallet`, append-only double-entry ledger written inside the engine transaction, starter grant at base deploy, treasury system account that receives all fees, system buyer paid from the treasury with floor prices, capped daily mint and treasury-health price scaling, fee and mint configuration in the balance config, money-supply invariant (wallets + escrow + treasury = grants + minted), read endpoints | 8 | ⬜ |
| 10.2 | Escrow and inbox (design §26.7): escrow service for goods and credits, per-player inbox, withdraw into base storage or a drive (capacity and quota checks), inbox size limit | 5 | ⬜ |
| 10.3 | Market terminal module (design §26.2): the `marketTerminal` module class and recipe, ops / energy costs, the `market.*` script functions skeleton with the new error codes, the **Trade** manual-control category and its settings switch | 5 | ⬜ |
| 10.4 | Resource exchange (design §26.4): order books per resource, limit and market orders, price-time matching inside the engine tick, partial fills, escrow, cancel and expiry, fees to the treasury, system buyer bid paid from the treasury, price bounds | 13 | ⬜ |
| 10.5 | Auctions (design §26.5–26.6): listings for scripts and blueprint items, bids with escrow and refunds, minimum step, buy-now, anti-sniping extension, cancellation rules, settlement, script editions (exclusive or N copies), fees | 13 | ⬜ |
| 10.6 | Market UI: market screen in a window (order books and price charts, auction list and detail, my orders and bids, wallet, inbox), terminal command `market`, translated strings | 13 | ⬜ |
| 10.7 | Chat backend (design §27.1): channels (`global-en`, `global-ru`) and private messages, Socket.IO namespace, 7-day history, rate limits, block list, reports, mute hooks, `/api/v1` endpoints (scope `chat`) | 8 | ⬜ |
| 10.8 | Chat UI: chat window (window manager) with channel list, private conversations, unread counters, presence, block and report actions, translated strings | 8 | ⬜ |
| 10.9 | Transfers (design §27.2): `/send` command and Send dialog, credits (instant, caps) and items (offer → accept / decline → inbox, expiry and return), system cards in the conversation, `/api/v1` endpoints (scope `trade`) | 8 | ⬜ |
| 10.10 | Anti-abuse and integrity (design §26.9): new-account limits, daily caps, price bands, per-player limits, wash-trading and multi-account heuristics raising admin alerts, ledger reconciliation job | 5 | ⬜ |
| 10.11 | Admin market and chat moderation (design §25): wallets and ledger viewer, money supply, treasury balance (fees in, purchases out, minted) and trade-volume charts, treasury and mint tuning, cancel listing, freeze wallet, refund, mute player, delete messages, report queue. **Every admin rule of Phase 9 applies, written here so that it is not forgotten (added 2026-10-15):** the new permissions are added to `lib/utils/admin.ts` and to the role table (for example `market.read` for owners, admins and analysts; `market.moderate`, `wallet.freeze`, `market.refund` and `chat.moderate` for owners and admins, with the destructive ones owner-only where design §25.2 says so, and a typed word for a refund or a freeze), every route declares its permission (the authorization matrix of 9.14 reads the routes from the OpenAPI document and fails on a route without one), every action asks for a reason and writes an audit line with before and after values (the matrix checks that too), money and goods move only through engine commands that write ledger entries (AGENTS.md §9: the console never updates a wallet or an inbox directly), the pages join the menu of the console and **each has a section in the admin documentation in English and Russian** (the test of 9.15 fails when a page of the console has none), and the generated permission and audit-action tables of 9.15 are regenerated | 8 | ⬜ |
| 10.12 | Notifications and achievements for trading: the Trade notification category, trade and transfer events on the event bus, achievements (First deal, Merchant, Generous) | 3 | ⬜ |
| 10.13 | Economy integrity tests: property tests that the money supply and item counts are conserved across orders, auctions, transfers and failures (fees reach the treasury, the buyer never exceeds treasury plus the daily mint budget); matching determinism; no duplicated or lost goods on crash and restart | 5 | ⬜ |
| 10.14 | E2E (Cypress): exchange order → fill → inbox → withdraw; auction create → bid → outbid → anti-snipe → win; script editions; inbox full and capacity limits; chat DM, block and report; transfer offer accept / decline / expiry; new-account limits; admin moderation of a listing and a message | 8 | ⬜ |
| 10.15 | **Market analytics and monitoring in the console** (design §25.3, Market and chat; added 2026-10-15 after a check found that 10.11 had the ledger, the money supply, the treasury, the trade-volume charts and the moderation actions, but no view of the market itself): **(a) The market, as an admin sees it:** an order-book page (every resource and script and blueprint market, the open orders by price with the depth, the spread) and an auctions page (open, ending soon, finished, bids, anti-snipe extensions), each readable by a row. **(b) Statistics and charts** (a window of 24 hours, 7 and 30 days, with CSV export that is audited like the exports of 9.11): price history per resource with the volume, the number of trades and of active listings, volume by resource and by market, the fees by kind that reached the treasury, the mint budget used against the daily limit, the top traders and the top sellers, the share of players who traded (the funnel of 9.11 gets the step "first trade"), and the chat volume and the reports by day. **(c) Price anomalies:** the flags that 10.10 raises (a price far outside its band, wash-trading and multi-account patterns) as a list with the players and trades behind it, a status (new, reviewed, dismissed, acted on), a link to the profile of 9.4 and to the actions of 10.11. **(d) Monitoring:** the market joins the metric catalog and the alert rules of 9.2: the open orders and the matching latency, the ledger reconciliation result of the job of 10.10 (a mismatch is **red**), the treasury balance against its floor, the mint budget used (yellow at 80 %), the rate of refused orders, and the size of the queues of the inbox and the transfers, with a market area on the dashboard of 9.3 and the thresholds in the generated table of 9.15. Read-only: it adds no way to change a balance. Includes: the read models and their integration tests against PostgreSQL (with numbers that are checked against the ledger), the permissions (`market.read`, `market.analytics`; owners, admins and analysts), the `authorization-matrix` entries, a Cypress spec (a trade made in the game shows in the order book, the price history and the volume; a flagged trade appears in the list and is reviewed), and the pages of the admin documentation in English and Russian | 5 | ⬜ |

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
