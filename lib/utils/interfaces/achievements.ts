// An achievement of the player, as the achievements page shows it (design §23). Titles and descriptions are translation keys of the
// `family`; a family with several levels (1 / 100 / 1,000 cells scanned) has one achievement per level.
export interface IAchievement {
  id: string
  family: string
  // 1 for the first level of a family, then 2, 3, ...
  level: number
  // How many levels the family has
  levels: number
  // What the counter must reach to unlock it
  threshold: number
  // Where the counter is now, at most the threshold
  progress: number
  // When it was unlocked (ms since the epoch); null while locked
  unlockedAt: number | null
}

// Pushed to the player's sockets as `achievement-unlocked`
export interface IAchievementUnlock {
  id: string
  family: string
  level: number
  levels: number
  threshold: number
  unlockedAt: number
}
