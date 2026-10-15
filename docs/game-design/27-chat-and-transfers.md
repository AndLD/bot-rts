[← Game design index](../GAME-DESIGN.md)

# 27. Chat and transfers

Chat and transfers are **player-level** features: they need no bot and no module. They are not part of the bot simulation, but
any change of wallets or inventories still goes through the engine as a command (single-writer rule, §14.2) and the ledger
(§26.1).

## 27.1 Chat ✅

- **Channels:** two **global channels** by language (`global-en`, `global-ru`; the player's UI language selects the default)
  and **private messages** between two players. Group channels and alliances are in the backlog (§21).
- **Rules:** messages up to 500 characters; at most 5 messages per 10 seconds per player; history kept 7 days (tunable);
  unread counters and online presence; a **block list** (a blocked player cannot message or send transfers to you); a
  **report** button on every message.
- **Moderation:** admins can mute a player, delete messages and review reports (§25; task 10.11), and the chat volume and the reports by day are part of the market statistics (task 10.15). A muted player cannot post in chat; transfers
  still follow their normal rules.
- Chat is available in the web client (as a window of the window manager), through the public API (scope `chat`, §22.1)
  and therefore to the MCP server. It is not available to bot scripts.

## 27.2 Transfers ✅

From a private conversation a player can send another player:

| Thing | Rules |
| --- | --- |
| **Credits** | Instant. Minimum 1 credit. Daily send cap depends on account age (§26.9). No refund. |
| **Resources** | From the sender's base storage. The recipient must **accept**. |
| **Blueprint items** | The recipient must **accept**. |
| **Scripts** | The sender chooses **copy** (keeps the original) or **move**. The recipient must **accept**. |

- The sender uses the `/send` command or the **Send** dialog; the transfer appears in the conversation as a system card with
  **Accept** and **Decline** buttons. Offers expire after 7 days (tunable) or when declined, and the goods return to the
  sender.
- Items of an accepted offer land in the recipient's **inbox** (§26.7) and are withdrawn like market purchases.
- No bot or module is needed. Transfers are not available to bot scripts, only through the GUI and the public API
  (scope `trade`), which keeps scripted spam and accidental transfers out.

## 27.3 The inbox ✅

One inbox per player holds everything awaiting withdrawal: market purchases and accepted transfers. Entries show their
source (market listing or sender) and can be withdrawn into a base storage or a drive when there is space.

## 27.4 Anti-abuse ✅

New-account limits, per-day transfer caps, rate limits, the block list, reports, and the same ledger and audit trail as the
market (§26.9). Receiving an unsolicited script never runs it.
