[← Plan](./README.md)

# Progress (checkpoint file, removed when the step's pull request merges)

### 2026-10-17 — step 1, review started
- **Done:** branch `docs/harness-quality-review-2026-10-17` cut from `origin/develop` at `a945aa6`; method, bindings and template read;
  seven context subagents (claims ledgers, M12) and the probes P1 to P7 started (Sonnet 5.5, medium). Probe choices: P2 = "Continue
  Phase 12" (the phase in progress), P6 = task 10.5 Auctions, P7 = tasks 10.1 and 10.7.
- **Next step:** run the measurements M1 to M33, then the cross-context checks, D12, D13, D14, D15, verification and the report
  `docs/quality-reviews/harness/2026-10-17.md`.
- **Open decisions:** none yet (budgets are proposed in the report for the owner's approval).
- **Verify with:** `git log --oneline origin/develop..HEAD`, `npm run docs:check`

### 2026-10-17 — step 1, report written
- **Done:** all measurements M1 to M33, the seven claims ledgers (100 % coverage), probes P1 to P7, the cross-context checks, the
  verification of every finding, and the report `docs/quality-reviews/harness/2026-10-17.md` (32 findings, scorecard, budgets
  proposed, export dry run with blockers B1 to B8). The report index `docs/quality-reviews/README.md` links it.
- **Next step:** the owner reads the scorecard, the top findings and the blockers, triages the follow-up table (section 13) and merges
  the pull request; this file is removed in that pull request before the merge. Then step 2 of the plan.
- **Open decisions:** H-01 (required checks), H-07 (release `develop` to `main` or change the default branch), H-13 and H-14 (Phase 10
  specification questions O1 to O11), H-15 (first source of iron), the budgets of section 9, the triage of every finding.
- **Verify with:** `npm run docs:check`, `npx prettier --check docs/quality-reviews/harness/2026-10-17.md`

### 2026-10-18 — owner answers to the Phase 10 questions (H-13, H-14; open items O1 to O11)
- **Done:** the owner answered the questions; they are recorded here until they are written into design §26, §27, §24 and §20:
  1. Editions of N copies are sold at a fixed price (buy-now only), not by auction.
  2. Selling a script never removes the seller's file: the buyer gets a copy.
  3. An admin may cancel a listing with bids; all bidders are refunded; refunding the seller's listing fee is a checkbox, on by default.
  4. Anti-sniping extensions are capped at a maximum number.
  5. Buy-now disappears once a bid above the buy-now price exists (wording to confirm); a buy-now refunds all bidders.
  6. The first bid may equal the starting price; the buy-now price must be greater than the starting price.
  7. An unsold item stays in escrow / the seller's inbox; the seller can list it again (with a new price) or take it back to storage.
  8. Market buy order lock: open, the owner asked for the factors.
  9. Order priority within one tick: open, the owner suggested bigger orders first and asked for a recommendation.
  10. Buyer's inbox full at settlement: both parties are notified; up to 5 automatic retries a few hours apart and 3 manual
      retries by the buyer (not counted in the 5); when the automatic retries are used up, the buyer is refunded and the goods go
      back to the seller.
  11. Only the first base deploy pays the starter grant.
  12. Goods bought are kept in escrow / the inbox until the buyer accepts them (the system-buyer part is to be clarified).
  13. Admin refunds are paid by the treasury (for now). Freezing a wallet closes all its orders, listings and bids and refunds
      everyone, including the fees the wallet owner paid.
  14. Open: the owner proposes letting the treasury go negative instead of minting, and asked about the risks.
  15. Transfer goods go to escrow when the offer is made. Daily limits: 10 (new accounts) and 50 (older accounts) sales or
      purchases per user; 1,000,000 (new) and 50,000,000 (older) credits per day. Tunable; scope to be confirmed.
  16. Add the missing events (transfer accepted, edition sold out, and the others the achievements need).
- **Next step:** get the open points (5, 6, 8, 9, 12, 14, 15) answered, then write all decisions into the design in one docs PR.
- **Open decisions:** points 5, 6, 8, 9, 12, 14, 15 above.
- **Verify with:** `npm run docs:check`

### 2026-10-18 — owner clarifications on the Phase 10 answers
- **Done:** recorded the clarifications:
  - 2: the "exclusive" mode is removed; a script is sold as an edition of 1 or more copies, and the fee grows with the number of copies.
  - 5: agreed: a bid that reaches the buy-now price ends the auction at that price.
  - 8 and 9: agreed with the recommendations (market orders carry a maximum total spend that is locked, IOC; priority = price,
    then earlier tick, then the engine's seeded per-tick order).
  - 10: the 5 automatic retries are spread over 24 hours; goods returned to a seller whose inbox is full stay in escrow.
  - 12: agreed on a system sink. System accounts are created from the admin console (not by sign-up), carry a `system: true`
    flag visible only on admin pages, have no email or password, and are managed only from the console.
  - 15: transfers between players: at most 50 (new accounts) and 500 (older accounts) per day; a new account may transfer at most
    100 credits per day. A wallet that receives many small transfers (each at most the new-account daily cap) is frozen
    automatically for one week, and the admins get a dedicated notification to decide. Every value is editable in the console.
- **Next step:** answer the owner's questions on 6 (why a minimum bid step) and 14 (how the treasury drains, inflation, the
  system bid scaling); confirm the remaining details; then write the design PR.
- **Open decisions:** 6 (keep a 5 % step or change it), 14 (negative treasury with a limit, or the capped mint), the default system
  accounts at first start, the threshold of "many small transfers", whether 10 / 50 per day still limits market trades.
- **Verify with:** `npm run docs:check`

### 2026-10-18 — owner decisions on the bid step and the treasury
- **Done:** 6: the minimum bid step stays 5 % (rounded up, tunable). 14: the system buyer does not buy while the treasury
  balance is not positive (no limit on a negative balance is needed); only refunds may take the treasury below zero. The owner
  also proposes a system seller.
- **Next step:** confirm: no daily mint any more; an initial treasury endowment; the system seller's source of goods and whether
  it belongs to Phase 10 or the backlog; plus the four earlier points (edition fee per copy, default system accounts, freeze
  trigger, market-trade limits). Then write the design PR.
- **Open decisions:** as in "Next step".
- **Verify with:** `npm run docs:check`

### 2026-10-18 — owner proposal: a treasury in two parts
- **Done:** the owner proposes two treasury accounts. The **main** one pays the system buyer. A **pending** one holds the fees of
  trades that are not finished (open listings and auctions, deliveries still being retried). Refunds of those fees come only from
  the pending part; when a trade finishes, its fees move to the main part.
- **Next step:** confirm that frozen-wallet refunds cover only the fees of open trades; decide where admin compensation refunds
  come from; then the earlier open points (no mint, initial endowment, system seller scope, edition fee per copy, default system
  accounts, freeze trigger, market-trade limits).
- **Open decisions:** as in "Next step".
- **Verify with:** `npm run docs:check`
