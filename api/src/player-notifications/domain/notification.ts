import type { NotificationCategory, NotificationParams } from '../../../../lib/utils/interfaces/notifications'

// A stored notification of a player (design §24.2)
export interface Notification {
  readonly id: string
  readonly userId: string
  readonly category: NotificationCategory
  readonly kind: string
  readonly params: NotificationParams
  readonly botId: string | null
  readonly count: number
  // When it happened, or will: a notification for something that finishes later (a craft) is stored at once and waits for its time
  readonly createdAt: Date
  // When the player was told; null while it waits for its time
  readonly deliveredAt: Date | null
  readonly readAt: Date | null
}

// What a game event or an unlock asks the notifications to say, before it is stored
export interface Candidate {
  category: NotificationCategory
  kind: string
  params: NotificationParams
  botId: string | null
  // Repeated candidates of this kind about this bot within the policy's window are coalesced; false for ones that differ each time
  isCoalesced: boolean
  // For something that is not over yet: the time to tell the player (ms since the epoch)
  dueAt?: number
}
