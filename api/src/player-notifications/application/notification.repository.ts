import type { NotificationCategory, NotificationPreferences } from '../../../../lib/utils/interfaces/notifications'
import type { Notification } from '../domain/notification'

export const NOTIFICATION_REPOSITORY = Symbol('NotificationRepository')
export const NOTIFICATION_PREFERENCES = Symbol('NotificationPreferenceRepository')

export interface ListQuery {
  limit: number
  // Only those older than this (the last of the previous page)
  before?: Date
  isUnreadOnly: boolean
}

// Where the notifications of the players are kept (design §24.2). Only delivered ones are listed and counted.
export interface NotificationRepository {
  add(notification: Notification): Promise<void>
  // Counts one more of the same unread notification and moves it to `at`; null when the player has read it already
  bump(id: string, at: Date): Promise<Notification | null>
  // Takes the notifications whose time has come and were not delivered, marks them delivered, and gives them (so only one process tells of each)
  claimDue(now: Date, limit: number): Promise<Notification[]>
  list(userId: string, query: ListQuery): Promise<Notification[]>
  unreadByCategory(userId: string): Promise<Partial<Record<NotificationCategory, number>>>
  // Marks as read the given notifications of the player, or all of them; gives how many changed
  markRead(userId: string, ids: readonly string[] | null, at: Date): Promise<number>
  deleteOlderThan(date: Date): Promise<number>
}

export interface NotificationPreferenceRepository {
  get(userId: string): Promise<NotificationPreferences>
  save(userId: string, preferences: NotificationPreferences): Promise<void>
}
