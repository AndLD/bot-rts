// The notifications a player gets about what happens in the game (design §24.2). The API sends a `kind` and its `params`, never the
// final text: the client writes it in the player's language (design §15.4).
export const NOTIFICATION_CATEGORIES = [
  'attacks',
  'damage',
  'scripts',
  'security',
  'fabrication',
  'trade',
  'achievements',
  'system'
] as const

export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number]

// Which categories the player wants to hear about; one that is not there is on
export type NotificationPreferences = Record<NotificationCategory, boolean>

export type NotificationParams = Record<string, string | number | boolean>

export interface INotification {
  id: string
  category: NotificationCategory
  // What happened, for example `underAttack`; the translation key of its text
  kind: string
  params: NotificationParams
  // The bot it is about, if any
  botId: string | null
  // How many times it happened: repeated events of one kind are coalesced into one notification (design §24.2)
  count: number
  // When it happened (ms since the epoch); the last time when it was coalesced
  createdAt: number
  readAt: number | null
}

export interface INotificationList {
  items: INotification[]
  // How many notifications the player has not read, in all, not only in this page
  unread: number
}

// "While you were away": what waits unread, by category (design §24.3)
export interface INotificationSummary {
  unread: number
  byCategory: Partial<Record<NotificationCategory, number>>
}

export interface INotificationPreferences {
  categories: NotificationPreferences
}

export const ALL_NOTIFICATIONS_ON: NotificationPreferences = Object.fromEntries(
  NOTIFICATION_CATEGORIES.map((category) => [category, true])
) as NotificationPreferences

// The preferences with every category the list does not mention on (so a category added later starts on)
export function withNotificationDefaults(
  switches: Partial<Record<string, boolean>> | null | undefined
): NotificationPreferences {
  return Object.fromEntries(
    NOTIFICATION_CATEGORIES.map((category) => [category, switches?.[category] !== false])
  ) as NotificationPreferences
}
