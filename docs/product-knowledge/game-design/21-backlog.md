[← Game design index](./GAME-DESIGN.md)

# 21. Backlog (deliberately out of scope for now)

- **Terrain types** (e.g. wheels vs tracks behaving differently per cell type, speed modifiers). Requires terrain on
  the map, which does not exist yet.
- **Alliances / shared fog of war**.
- **Leaderboard**.
- **Layered world** using `z` .
- **Physical port module**: wired connection bot↔bot or bot↔base, making a bot connectable without a wireless adapter
  (would relax the assembly rule that a wireless adapter is mandatory, §8.2).
- **World sharding by region** across several engine processes: requires solving cross-region movement, scans,
  combat and messaging.
- **Mobile support**: a read-only mobile view (map and bot status); the terminal, editor and manual control stay desktop-only.
- **Browser push and email digests** for notifications (§24.3).
- **Cosmetic achievement rewards** (badges, sprite skins) (§23).
- **More UI languages** beyond English and Russian (§15.4).
- **Group chat channels and alliances** (§27.1).
- **Trading modules and bots**, and physical delivery of goods (§26.3).
- **Bot-script access to transfers** (§27.2).
- **Admin console extras** (webhook alert channels and an on-call schedule, player reports and a support inbox, scripted admin
  automation through a separate admin API key type, a second store for the metrics history): kept in their own
  list in §25.6.
