// How the game notifies a player (design §24.2); tunable configuration
export interface PlayerNotificationsConfig {
  // How long a notification is kept, in days
  retentionDays: number
  // Repeated events of one kind about one bot within this many ms are one notification with a count
  coalesceMs: number
  // The most notifications of one category a player gets in a minute; the rest are dropped
  capPerMinute: number
}

export const DEFAULT_PLAYER_NOTIFICATIONS: PlayerNotificationsConfig = {
  retentionDays: 30,
  coalesceMs: 30_000,
  capPerMinute: 30
}
