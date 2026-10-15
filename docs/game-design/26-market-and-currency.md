[← Game design index](../GAME-DESIGN.md)

# 26. Market and currency

## 26.1 Currency: credits ✅

- The in-game currency is **credits**. Every player has one **wallet** at the **account level** (not tied to a base, so it
  survives base loss and redeploys).
- **Faucets (credits entering the economy):** a **starter grant** when the player first deploys a base (default 1,000
  credits), and the **system buyer** (§26.4), which buys resources at fixed **floor prices** from the balance config
  (placeholder defaults per unit: iron 1, stone 1, wood 1, oil 3, crystal 5, gold 12). The buyer pays from the treasury
  first and only **mints** new credits within a capped budget (below).
- **Fees go to the treasury, they never vanish.** Listing and sales fees (§26.4–26.5), and crafting, research and repair fees
  where the balance config sets them, are **transferred** to the **treasury**, a system account in the ledger that belongs to
  no player. Credits are therefore only ever moved, never destroyed.
- **The treasury funds the system buyer.** Every purchase by the system buyer is paid from the treasury, so the fees players
  pay come back to them as demand for their resources. This closes the loop: the more the players trade and craft, the more
  the system can buy.
- **Bounded minting.** When the treasury holds less than its **reserve** (tunable), the buyer may mint the missing credits, but
  only up to a **daily mint budget** (tunable). When the budget is spent, the buyer pays only what the treasury can afford:
  its bids are reduced proportionally to the treasury balance and resume as fees arrive. The money supply can therefore grow
  only through starter grants and the capped mint, never without limit.
- **Treasury health:** an optional rule scales the floor prices by `clamp(treasury / target, minFactor, 1)`, so a nearly empty
  treasury lowers the system's bids instead of printing money. Admins tune the reserve, the daily mint budget, the target and
  the factors, and watch the treasury balance, fees in, purchases out and credits minted per day (§25).
- **Ledger:** every change of a wallet, an escrow or the treasury is an entry in an **append-only double-entry ledger** inside
  the same engine transaction. The invariant is: wallets + escrow + treasury = starter grants + credits minted. A
  reconciliation job checks it and the admin console shows it (§25).

## 26.2 The market terminal module ✅

- A new module type, **`marketTerminal`**, with a **single class**: no upgrades. It is crafted like any other module (default
  recipe: 40 iron, 20 crystal, 15 gold, 20 s — tunable) and is **not** in the base starter kit.
- The market is **remote**: a bot with a working market terminal can use the market from anywhere, with no wireless-range
  requirement and independent of the radio network (§11.2.1). Each market call costs ops and energy like any other module call, and a broken market terminal stops working.
- The module grants the `market` script functions (§10.2) and the **Trade** manual-control category (§15.1). The market
  screen of the web client is available to a player who has at least one bot with a working market terminal.

## 26.3 What can be traded ✅

| Thing | Venue |
| --- | --- |
| **Resources** (gold, iron, oil, crystal, stone, wood) | Resource exchange (§26.4) |
| **Scripts** | Auctions (§26.5) |
| **Blueprint items** (§9.3) | Auctions |

Modules and bots are not tradable for now (backlog, §21). Credits are not an item: they are moved between wallets by the
market and by transfers (§27).

## 26.4 Resource exchange (order book) ✅

- One **order book per resource**, quoted in credits per unit. Players place **limit orders** to buy or sell, or a **market
  order** that takes the best available prices.
- **Matching:** price-time priority, partial fills allowed, no self-trading. Matching runs **in the engine** as part of the
  tick's collect-then-apply (§12.4, §14.2), so it is deterministic and conflict-free.
- **Escrow:** a sell order locks the resources and a buy order locks the credits at placement. Cancelling releases them.
  Orders expire after 7 days (tunable).
- **Fees:** the seller pays a 2 % fee on the value of each trade (tunable); it goes to the treasury (§26.1).
- The **system buyer** (§26.1) acts as a standing bid at the floor price for each resource, paid from the treasury (and a
  capped mint when the treasury is short); there is no system seller.

## 26.5 Auctions ✅

- **Listings:** a seller lists a script (an edition, §26.6) or a blueprint item with a starting price, a duration (1 hour to
  7 days) and an optional **buy-now** price.
- **Bids:** each bid must beat the current bid by at least max(1 credit, 5 %). The bidder's credits are locked in escrow;
  the previous bidder is refunded at once. A bid in the **last 2 minutes** extends the auction by 2 minutes (anti-sniping).
  A seller cannot bid on their own listing.
- **Settlement:** at the end (or on buy-now) the engine moves the item to the winner's inbox and the credits, minus fees,
  to the seller's wallet. A listing can be cancelled only while it has no bids.
- **Fees:** a listing fee of 1 % of the starting price (minimum 1 credit, not refunded) and a sales fee of 5 % of the final
  price (tunable); both go to the treasury (§26.1).

## 26.6 Selling scripts ✅

At listing the seller chooses **exclusive** (the seller's file is removed when it sells) or an **edition of N copies**
(each sale is one copy; the listing ends when the edition is sold out). The buyer receives the full, editable source in the
inbox. There is no copy protection: scarcity comes from limited editions and the seller's reputation. A purchased script
must be accepted into a drive before it can run (a script never runs by itself).

## 26.7 Escrow and inbox ✅

- The market holds items and bids in **escrow**, so a sale can never fail for lack of goods or funds.
- Bought items arrive in the buyer's **inbox** (shared with transfers, §27.3) and are withdrawn to a base storage
  (resources, blueprint items) or to a drive (scripts) with a command or button, subject to free capacity or quota. The inbox
  holds up to 100 entries (tunable); when it is full, new sales to that player are refused.
- Seller proceeds go straight to the wallet.

## 26.8 Script API, events and notifications ✅

- The `market` functions (§10.2) cover order books, orders, auctions, bids, buy-now, the wallet and claiming the inbox, and
  use new error codes (`NO_FUNDS`, `NOT_FOUND`, `TOO_LOW`, `EXPIRED`, `INBOX_FULL`).
- Events (§24.1): `OrderPlaced`, `OrderFilled`, `AuctionBid`, `AuctionOutbid`, `AuctionWon`, `AuctionSold`,
  `AuctionExpired`. They are private to the participants, appear in the new **Trade** notification category (§24.2) and
  feed achievements (§23).
- Public order books and active auctions are visible to everyone who can use the market.

## 26.9 Anti-abuse ✅

- **New-account limits:** an account younger than 24 hours (tunable) cannot create auctions and has a low daily cap on credits
  sent or received through transfers.
- **Price bounds** on orders (a band around the recent average) and per-player order and listing limits.
- **Rate limits** on market calls; **wash-trading and multi-account heuristics** (same IP, circular trades) raise admin alerts.
- Every market action is in the ledger and the audit trail; admins can cancel a listing, freeze a wallet and refund (§25), and see the market itself (order books, auctions, price history and statistics, the price anomalies these heuristics flag, and market metrics and alerts on the dashboard: tasks 10.11 and 10.15).
