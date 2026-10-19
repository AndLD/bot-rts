[← Game design index](./GAME-DESIGN.md)

# 27. Chat and transfers

Chat and transfers are **player-level** features: they need no bot and no module. They are not part of the bot simulation, but
any change of wallets or inventories still goes through the engine as a command (single-writer rule, §14.2) and the ledger
(§26.1).

## 27.1 Chat

- **Channels:** two **global channels** by language (`global-en`, `global-ru`; the player's UI language selects the default)
  and **private messages** between two players. Group channels and alliances are in the backlog (§21).
- **Rules:** messages up to 500 characters; at most 5 messages per 10 seconds per player; history kept 7 days (tunable);
  unread counters and online presence; a **block list** (a blocked player cannot message or send transfers to you); a
  **report** button on every message.
- **Moderation:** admins can mute a player, delete messages and review reports (§25), and the chat volume and the reports by day are part of the market statistics. A muted player cannot post in chat; transfers
  still follow their normal rules.
- Chat is available in the web client (as a window of the window manager), through the public API (scope `chat`, §22.1)
  and therefore to the MCP server. It is not available to bot scripts.

## 27.2 Transfers

From a private conversation a player can send another player:

| Thing | Rules |
| --- | --- |
| **Credits** | Instant. Minimum 1 credit. Daily caps depend on account age (§27.4). No refund. |
| **Resources** | From the sender's base storage. The recipient must **accept**. |
| **Blueprint items** | The recipient must **accept**. |
| **Scripts** | The sender chooses **copy** (keeps the original) or **move**. The recipient must **accept**. |

- The sender uses the `/send` command or the **Send** dialog; the transfer appears in the conversation as a system card with
  **Accept** and **Decline** buttons. The offered goods move into **escrow** when the offer is made, so they cannot be spent twice.
  Offers expire after 7 days (tunable) or when declined, and the goods return from escrow to the sender (to the sender's inbox,
  §27.3).
- Items of an accepted offer land in the recipient's **inbox** (§26.7) and are withdrawn like market purchases.
- No bot or module is needed. Transfers are not available to bot scripts, only through the GUI and the public API
  (scope `trade`), which keeps scripted spam and accidental transfers out.

**States of a transfer offer** (items; credits are instant and have no offer):

| State | Meaning | Next |
| --- | --- | --- |
| Pending | the goods are in escrow and the offer is a card in the conversation | accepted, declined, expired |
| Accepted | the recipient pressed Accept; the goods land in the recipient's inbox | final |
| Declined | the recipient pressed Decline; the goods return to the sender's inbox | final |
| Expired | 7 days (tunable) passed; the goods return to the sender's inbox | final |

## 27.3 The inbox

One inbox per player holds everything awaiting withdrawal: market purchases and accepted transfers. Entries show their
source (market listing or sender) and can be withdrawn into a base storage or a drive when there is space.

## 27.4 Anti-abuse

All numbers are defaults that admins change in the console (§25).

- **Daily limits per player:** at most 50 transfers per day for a new account (younger than 24 hours) and 500 for an older one;
  a new account can send at most 100 credits per day.
- **Automatic freeze:** a wallet that receives 10 or more small transfers (each at most the new-account daily credit cap) within
  24 hours, from at least 3 different senders, is frozen for one week (§26.9), and the admins get a dedicated notification to
  decide what happens to the wallet and the player (§25).
- Rate limits, the block list, reports, and the same ledger and audit trail as the market (§26.9). Receiving an unsolicited
  script never runs it.
