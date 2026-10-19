[← Game design index](./GAME-DESIGN.md)

# 26. Market and currency

## 26.1 Currency, accounts and the treasury

_Decisions of the owner of 2026-10-17 and 2026-10-18 (harness review H-20261017-13 and -14)._

- The in-game currency is **credits**. Every player has one **wallet** at the **account level** (not tied to a base, so it
  survives base loss and redeploys).
- **System accounts** are accounts of the game, not of a player: they have no email and no password, cannot sign in, carry the
  flag `system: true`, and are created and managed only from the admin console (§25). The flag is shown only on admin pages; a
  player never sees it. The first deployment creates three of them: the **treasury** (main), the **pending-trades wallet** and
  the **system sink** (below). Admins can create more.
- **The treasury has two parts:**
  - **Main** receives every fee once its trade is final, pays the **system buyer** and pays admin compensation refunds.
  - **Pending trades** holds the fees of trades that are not final yet (an open listing or auction, a delivery that is still
    being retried, §26.7). Refunds of those fees come only from here, so a fee refund can never fail. When a trade becomes
    final, its fees move to main. Nobody can deposit into this wallet by hand.
- **Custom admin wallets:** admins can create any number of further wallets (for example for events or prizes) and move
  credits between main and those wallets. Every move is a ledger entry with a reason, audited (§25.2).
- **How credits enter the economy:**
  - the **starter grant**, paid automatically on a player's **first** base deploy only (default 1,000 credits; a redeploy after
    a lost base pays nothing);
  - **manual minting** by an admin from the console, into main or a custom admin wallet, with a reason (audited, two-factor).
    The initial endowment of the treasury is such a manual mint.

  There is no automatic minting: the money supply grows only through these two.
- **Fees** (editable in the console per kind and, for the exchange, per resource): the exchange fee (default 2 % of each trade),
  the auction listing fee (default 1 % of the starting price, at least 1 credit), the auction sales fee (default 5 % of the final
  price) and the edition fee (default 1 % of the price per copy offered, §26.6). Fees are **moved**, never destroyed.
- **The system buyer** buys from players. It pays only from main and **buys only while main can pay**: when main is not positive
  it stops, and it resumes when fees arrive. The goods it buys go to the **system sink**, a goods account of the ledger, so goods
  are conserved (below).
- **The system seller** sells the goods in the system sink, and only those: it never creates goods. What it earns goes to main once
  the goods are delivered (§26.7), so it brings credits back into the treasury and brakes inflation.
- What the two trade, when, at which price and in which quantities is configured by admins (the **system trader**, §26.10).
- **Admin compensation refunds** (for example after a bug) are manual, paid from main, and refused when main cannot cover them,
  unless the admin ticks an explicit override after a warning; only such a refund can take main below zero. While main is
  negative the system buyer does not buy.
- **Ledger:** every change of a wallet, an escrow, the treasury, a custom admin wallet, an inbox or the system sink is an entry
  in an **append-only double-entry ledger** inside the same engine transaction. Two invariants are checked by a reconciliation
  job and shown in the console (§25):
  - **credits:** player wallets + escrow + treasury main + pending trades + custom admin wallets = starter grants + credits
    minted by admins;
  - **goods:** trading moves a good between a player's storage, escrow, an inbox and the system sink and never creates or
    destroys one; the only goods a trade creates are the copies of a script edition, each recorded as a copy issued (§26.6).

## 26.2 The market terminal module

- A new module type, **`marketTerminal`**, with a **single class**: no upgrades. It is crafted like any other module (default
  recipe: 40 iron, 20 crystal, 15 gold, 20 s — tunable) and is **not** in the base starter kit.
- The market is **remote**: a bot with a working market terminal can use the market from anywhere, with no wireless-range
  requirement and independent of the radio network (§11.2.1). Each market call costs ops and energy like any other module call, and a broken market terminal stops working.
- The module grants the `market` script functions (§10.2) and the **Trade** manual-control category (§15.1). The market
  screen of the web client is available to a player who has at least one bot with a working market terminal.

## 26.3 What can be traded

| Thing | Venue |
| --- | --- |
| **Resources** (gold, iron, oil, crystal, stone, wood) | Resource exchange (§26.4) |
| **Scripts** | Editions: a fixed price, or an auction for a single copy (§26.6) |
| **Blueprint items** (§9.3) | Auctions |

Modules and bots are not tradable for now (backlog, §21). Credits are not an item: they are moved between wallets by the
market and by transfers (§27).

## 26.4 Resource exchange (order book)

- One **order book per resource**, quoted in credits per unit. Players place **limit orders** to buy or sell, or **market orders**.
- **Market orders** are filled at once and never rest in the book: a market buy states a **maximum total spend**, which is
  locked at placement; a market sell locks its resources. In the next tick the order takes the best available prices, the unfilled
  part is cancelled, and the unspent credits or unsold resources are released.
- **Matching:** price first; at the same price, the order placed in an earlier tick first; within one tick, the engine's seeded
  per-tick order (§12.4), the same order that settles every other conflict. Partial fills are allowed, self-trading is not.
  Matching runs **in the engine** as part of the tick's collect-then-apply (§12.4, §14.2), so it is deterministic and
  conflict-free.
- **Escrow:** a sell order locks the resources and a buy order locks the credits at placement. Cancelling releases them.
  Orders expire after 7 days (tunable).
- **Fees:** the seller pays the exchange fee on the value of each trade (§26.1); it waits in pending trades until the bought
  resources are delivered (§26.7), then moves to main.
- The **system buyer** and the **system seller** (§26.1) act as a standing bid and a standing offer for the resources their rules
  cover, at the prices of those rules (§26.10).

**States of an order:**

| State | Meaning | Next |
| --- | --- | --- |
| Open | resting in the book with its goods or credits in escrow; a market order is open only until the next tick | partly filled, filled, cancelled, expired |
| Partly filled | some of it traded; the rest rests in the book | filled, cancelled, expired |
| Filled | all of it traded | final |
| Cancelled | by the player, or the unfilled part of a market order at the next tick; the escrow is released | final |
| Expired | 7 days (tunable) passed; the escrow is released | final |

## 26.5 Auctions

- **What is auctioned:** a blueprint item, or a script sold as a single copy (§26.6). A seller lists it with a starting price, a
  duration (1 hour to 7 days, tunable) and an optional **buy-now** price, which must be greater than the starting price.
- **Bids:** the first bid must be at least the starting price; every later bid must beat the current bid by at least
  max(1 credit, 5 %), the 5 % rounded up to whole credits (tunable). The bidder's credits are locked in escrow; the previous
  bidder is refunded at once. A seller cannot bid on their own listing.
- **Anti-sniping:** a bid in the **last 2 minutes** extends the auction by 2 minutes, at most 10 times (all three tunable).
- **Buy-now:** available until a bid reaches the buy-now price. A buy-now ends the auction at once and refunds every bidder;
  a bid that reaches the buy-now price ends the auction too, and that bidder wins at that price.
- **Settlement:** at the end, or on buy-now, the engine moves the item to the winner's inbox and the credits, minus the sales
  fee, to the seller's wallet. Proceeds and fees stay in pending trades until the item is delivered (§26.7).
- **No bids at the end:** the item stays in escrow for the seller, who can list it again (at a new price) or withdraw it to
  storage.
- **Cancelling:** the seller can cancel only while there are no bids. An admin can cancel at any time, with a reason: every
  bidder is refunded, and a checkbox (on by default) refunds the seller's listing fee from pending trades (§25).
- **Fees:** the listing fee (paid at listing, kept in pending trades until the auction ends, not refunded except by an admin
  cancel) and the sales fee (§26.1).

**States of an auction:**

| State | Meaning | Next |
| --- | --- | --- |
| Open | listed, no bid yet; the item is in escrow | bidding, cancelled by the seller or an admin, unsold when the time is up |
| Bidding | at least one bid; the high bidder's credits are in escrow; a bid in the last 2 minutes extends the end (at most 10 times) | sold, cancelled by an admin |
| Sold | the time is up with a winner, or a buy-now (a bid that reaches the buy-now price ends it too); the item goes to the winner's inbox, the credits to the seller minus the fee | final (proceeds stay in pending trades until delivery, §26.7) |
| Unsold | the time is up with no bid; the item stays in escrow for the seller, who lists it again or withdraws it | final |
| Cancelled | the seller (only while there is no bid) or an admin (any time, with a reason; every bidder is refunded) | final |

## 26.6 Selling scripts

A script is sold as an **edition of N copies** (N ≥ 1). **The seller keeps the original file**: the buyer gets a copy, the full,
editable source, in the inbox. An edition of one copy can be auctioned (§26.5); an edition of more copies is sold at a
**fixed price**, each purchase buying one copy at once, and the listing ends when the edition is sold out or cancelled. The
edition fee is charged per copy offered (§26.1), so a larger edition costs more to list; a sales fee applies to each copy sold.
There is no copy protection: scarcity comes from limited editions and the seller's reputation. A purchased script must be
accepted into a drive before it can run (a script never runs by itself).

## 26.7 Escrow, inbox and delivery

- The market holds items and bids in **escrow**, so a sale can never fail for lack of goods or funds.
- Bought items arrive in the buyer's **inbox** (shared with transfers, §27.3) and stay there until the buyer withdraws them to a
  base storage (resources, blueprint items) or a drive (scripts), subject to free capacity or quota. The inbox holds up to 100
  entries (tunable).
- **Delivery when the inbox is full:** the trade waits. Buyer and seller are both notified; delivery is retried automatically up
  to 5 times, spread evenly over 24 hours (both tunable), and the buyer can retry by hand up to 3 more times (not counted in the
  5). When the automatic retries are used up without success, the buyer is refunded in full, the fees return from pending
  trades, and the goods go back to the seller; if the seller's inbox is full, they stay in escrow until the seller withdraws
  them.
- Seller proceeds go straight to the wallet once the goods are delivered.

## 26.8 Script API, events and notifications

- The `market` functions (§10.2) cover order books, orders, auctions, bids, buy-now, editions, the wallet and claiming the inbox,
  and return the error codes `NO_FUNDS`, `NOT_FOUND`, `TOO_LOW`, `EXPIRED` and `INBOX_FULL` (§10.3) among others.
- Events (§24.1): `OrderPlaced`, `OrderFilled`, `AuctionBid`, `AuctionOutbid`, `AuctionWon`, `AuctionSold`, `AuctionExpired`,
  `AuctionCancelled`, `EditionCopySold`, `EditionSoldOut`, `DeliveryWaiting` (the buyer's inbox is full; to both parties),
  `DeliveryFailed` (the retries are used up; to both parties) and `WalletFrozen`. They are private to the participants, appear in
  the **Trade** notification category (§24.2) and feed achievements (§23).
- Public order books, active auctions and editions are visible to everyone who can use the market.

## 26.9 Anti-abuse

All numbers below are defaults that admins change in the console (§25).

- **New accounts:** an account younger than 24 hours cannot create auctions or editions.
- **Daily limits per player:** at most 10 market sales or purchases per day for a new account and 50 for an older one, and at most
  1,000,000 credits (new) and 50,000,000 credits (older) of market trades per day. Transfers have their own limits (§27.4).
- **Price bounds** on orders (a band around the recent average) and per-player order and listing limits.
- **Rate limits** on market calls; **wash-trading and multi-account heuristics** (same IP, circular trades) raise admin alerts.
- **Freezing a wallet** (by an admin, or automatically, §27.4) closes all its open orders, listings, auctions and bids at once and
  refunds everyone involved, the wallet owner's fees for those open trades included (from pending trades). Finished trades are
  never undone.
- Every market action is in the ledger and the audit trail; admins can cancel a listing, freeze a wallet and refund (§25), and see the market itself (order books, auctions, price history and statistics, the price anomalies these heuristics flag, and market metrics and alerts on the dashboard).

## 26.10 The system trader

_Decided by the owner on 2026-10-18._ The system buyer and the system seller (§26.1) follow **rules** that admins edit in the
console (§25). A change is audited (reason, before and after) and takes effect at the next tick boundary, so the engine applies one
rule set per tick and stays deterministic.

- **What is traded:** a rule names one tradable item, a resource or a blueprint item, and a side, buy or sell. Further item types
  (for example modules, once they are tradable, §21) join by adding rules, not by changing the rule model. On the exchange a rule
  is a standing bid or offer; for a blueprint item it is a fixed-price offer.
- **Price:** each rule sets its price in one of three ways, always clamped between a minimum and a maximum:
  - **fixed:** a number of credits per unit;
  - **floor × factor:** the floor price of the balance configuration (placeholder defaults per unit: iron 1, stone 1, wood 1, oil 3,
    crystal 5, gold 12) times a factor (by default 1 for buying and 3 for selling, so buying from the system and selling straight
    back never pays);
  - **market-following:** the recent average trade price of the item plus or minus a spread.

  A buying rule can also apply the treasury-health scaling, its price times `clamp(main / target, minFactor, 1)`, so the bids fade
  as the treasury runs low instead of stopping abruptly.
- **Volume and budget:**
  - a daily spend cap of the buyer, from main, and a minimum balance of main that the buyer never spends below;
  - per-player daily quantity caps for buying from players and for selling to them;
  - a reserve stock that the seller keeps in the sink, and a maximum stock above which the buyer stops buying the item.
- **Eligibility:** a minimum account age to trade with the system, and players flagged by the anti-abuse heuristics (§26.9)
  excluded.
- **Schedules:** each rule is active always, in time windows of the day, on chosen days of the week, or between a start and an end
  date. Schedules use real time in a time zone that admins choose, because they follow real-world events.
- **Campaigns:** named sets of rules with their own schedule and a priority, for example "crystal bought at 2× this weekend". For
  each item and side, the active rule of the highest priority wins; the base rules have the lowest priority. Before saving, the
  console previews the expected daily spend and income from the recent volume. A campaign can send an announcement to players
  (§24.2).
- **Pause:** a global switch stops the system buyer, the system seller, or both, at once.
- Players see the system's bids and offers in the order books like any other order, marked as the system's. They do not see the
  rules, the caps or the treasury balance.

