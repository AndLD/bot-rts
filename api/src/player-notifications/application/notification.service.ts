import type { IAchievementUnlock } from '../../../../lib/utils/interfaces/achievements'
import {
  INotification,
  INotificationList,
  INotificationPreferences,
  INotificationSummary,
  NOTIFICATION_CATEGORIES,
  NotificationCategory,
  NotificationPreferences
} from '../../../../lib/utils/interfaces/notifications'
import type { GameEventConsumer } from '../../engine/application/game-event-dispatcher'
import type { GameEvent } from '../../engine/domain/game-event'
import type { Clock } from '../../shared/application/clock'
import type { IdGenerator } from '../../shared/application/id-generator'
import type { Logger } from '../../shared/application/logger'
import { ValidationError } from '../../shared/domain/errors'
import type { Candidate, Notification } from '../domain/notification'
import { candidatesOf } from '../domain/notification-rules'
import type { PlayerNotificationsConfig } from '../domain/notification-policy'
import type { NotificationPreferenceRepository, NotificationRepository } from './notification.repository'

export type NotificationListener = (userId: string, notification: INotification) => void

const MINUTE_MS = 60_000
// How long a player's preferences are remembered before they are read again; they change rarely and events come often
const PREFERENCES_TTL_MS = 10_000
const DUE_BATCH = 100
// How many players an announcement is stored for at once
const ANNOUNCE_CONCURRENCY = 25
export const MAX_PAGE = 100

export const toView = (notification: Notification): INotification => ({
  id: notification.id,
  category: notification.category,
  kind: notification.kind,
  params: notification.params,
  botId: notification.botId,
  count: notification.count,
  createdAt: notification.createdAt.getTime(),
  readAt: notification.readAt?.getTime() ?? null
})

// Notifications (design §24.2): turns the game events a player hears into notifications they can read later, tells their sockets at
// once, and keeps them for a limited time. Repeated events are coalesced into one with a count, and a category has a per-minute cap, so
// a bot under fire does not bury the player. It runs outside the tick path, like every consumer of the events.
export class NotificationService implements GameEventConsumer {
  private readonly listeners = new Set<NotificationListener>()
  // The last unread notification of each kind about a bot, and when it was last told
  private readonly open = new Map<string, { id: string; at: number }>()
  // When the last notifications of each category of a player were made, for the cap
  private readonly recent = new Map<string, number[]>()
  private readonly preferences = new Map<string, { value: NotificationPreferences; at: number }>()

  constructor(
    private readonly repository: NotificationRepository,
    private readonly preferenceRepository: NotificationPreferenceRepository,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
    private readonly logger: Logger,
    private readonly config: PlayerNotificationsConfig
  ) {}

  async consume(userId: string, event: GameEvent): Promise<void> {
    for (const candidate of candidatesOf(userId, event)) {
      await this.raise(userId, candidate)
    }
  }

  // An achievement was unlocked (design §23.1)
  async achievementUnlocked(userId: string, unlock: IAchievementUnlock): Promise<void> {
    await this.raise(userId, {
      category: 'achievements',
      kind: 'achievementUnlocked',
      params: { family: unlock.family, level: unlock.level, levels: unlock.levels, threshold: unlock.threshold },
      botId: null,
      isCoalesced: false
    })
  }

  // An announcement of the admins to the given players (design §25.3, Operations); a player who turned the system category off
  // is not told, like with any other notification
  async announce(userIds: readonly string[], text: string): Promise<void> {
    for (let from = 0; from < userIds.length; from += ANNOUNCE_CONCURRENCY) {
      await Promise.all(
        userIds.slice(from, from + ANNOUNCE_CONCURRENCY).map((userId) =>
          this.raise(userId, {
            category: 'system',
            kind: 'announcement',
            params: { text },
            botId: null,
            isCoalesced: false
          })
        )
      )
    }
  }

  onNotification(listener: NotificationListener): () => void {
    this.listeners.add(listener)

    return () => this.listeners.delete(listener)
  }

  // Tells of what was waiting for its time (a craft that finished)
  async deliverDue(): Promise<void> {
    this.prune()
    for (const notification of await this.repository.claimDue(this.clock.now(), DUE_BATCH)) {
      this.tell(notification)
    }
  }

  // Forgets what is older than the retention
  async purge(): Promise<number> {
    const olderThan = new Date(this.clock.now().getTime() - this.config.retentionDays * 24 * 3600 * 1000)

    return this.repository.deleteOlderThan(olderThan)
  }

  async list(
    userId: string,
    query: { limit?: number; before?: number; isUnreadOnly?: boolean }
  ): Promise<INotificationList> {
    const limit = Math.min(Math.max(1, query.limit ?? 50), MAX_PAGE)
    const [items, byCategory] = await Promise.all([
      this.repository.list(userId, {
        limit,
        before: query.before === undefined ? undefined : new Date(query.before),
        isUnreadOnly: query.isUnreadOnly ?? false
      }),
      this.repository.unreadByCategory(userId)
    ])

    return { items: items.map(toView), unread: sum(byCategory) }
  }

  async summary(userId: string): Promise<INotificationSummary> {
    const byCategory = await this.repository.unreadByCategory(userId)

    return { unread: sum(byCategory), byCategory }
  }

  // Marks the given notifications of the player as read, or every one when no ids are given
  async markRead(userId: string, ids?: readonly string[]): Promise<number> {
    return this.repository.markRead(userId, ids ?? null, this.clock.now())
  }

  async getPreferences(userId: string): Promise<INotificationPreferences> {
    return { categories: await this.preferenceRepository.get(userId) }
  }

  async updatePreferences(userId: string, patch: Partial<Record<string, unknown>>): Promise<INotificationPreferences> {
    const changes: Partial<NotificationPreferences> = {}

    for (const [name, value] of Object.entries(patch)) {
      if (!NOTIFICATION_CATEGORIES.includes(name as NotificationCategory) || typeof value !== 'boolean') {
        throw new ValidationError(`Invalid notification setting: ${name}`)
      }
      changes[name as NotificationCategory] = value
    }
    const categories = { ...(await this.preferenceRepository.get(userId)), ...changes }
    await this.preferenceRepository.save(userId, categories)
    this.preferences.delete(userId)

    return { categories }
  }

  // Forgets what can no longer matter, so the memory of a long-running process does not grow with every player it has seen
  private prune(): void {
    const now = this.clock.now().getTime()

    for (const [key, last] of this.open) {
      if (now - last.at >= this.config.coalesceMs) {
        this.open.delete(key)
      }
    }
    for (const [key, times] of this.recent) {
      if (times.every((at) => now - at >= MINUTE_MS)) {
        this.recent.delete(key)
      }
    }
    for (const [userId, remembered] of this.preferences) {
      if (now - remembered.at > PREFERENCES_TTL_MS) {
        this.preferences.delete(userId)
      }
    }
  }

  private async raise(userId: string, candidate: Candidate): Promise<void> {
    try {
      if (!(await this.isWanted(userId, candidate.category))) {
        return
      }
      const now = this.clock.now()
      // A repeat that joins a notification is not a new one, so it does not count against the cap
      if (candidate.isCoalesced && (await this.coalesce(userId, candidate, now))) {
        return
      }
      if (this.isOverCap(userId, candidate.category)) {
        return
      }
      const isDue = candidate.dueAt === undefined || candidate.dueAt <= now.getTime()
      const notification: Notification = {
        id: this.ids.next(),
        userId,
        category: candidate.category,
        kind: candidate.kind,
        params: candidate.params,
        botId: candidate.botId,
        count: 1,
        createdAt: isDue ? now : new Date(candidate.dueAt as number),
        deliveredAt: isDue ? now : null,
        readAt: null
      }
      await this.repository.add(notification)
      if (isDue) {
        this.remember(userId, candidate, notification.id, now.getTime())
        this.tell(notification)
      }
    } catch (error) {
      this.logger.error(error)
    }
  }

  // Adds to the notification of the same kind about the same bot that was told a moment ago, if the player has not read it
  private async coalesce(userId: string, candidate: Candidate, now: Date): Promise<boolean> {
    const key = this.keyOf(userId, candidate)
    const last = this.open.get(key)

    if (!last || now.getTime() - last.at >= this.config.coalesceMs) {
      return false
    }
    const bumped = await this.repository.bump(last.id, now)
    if (!bumped) {
      return false
    }
    this.open.set(key, { id: last.id, at: now.getTime() })
    this.tell(bumped)

    return true
  }

  private remember(userId: string, candidate: Candidate, id: string, at: number): void {
    if (candidate.isCoalesced) {
      this.open.set(this.keyOf(userId, candidate), { id, at })
    }
  }

  private keyOf(userId: string, candidate: Candidate): string {
    return `${userId}|${candidate.category}|${candidate.kind}|${candidate.botId ?? ''}`
  }

  private async isWanted(userId: string, category: NotificationCategory): Promise<boolean> {
    const now = this.clock.now().getTime()
    let remembered = this.preferences.get(userId)

    if (!remembered || now - remembered.at > PREFERENCES_TTL_MS) {
      remembered = { value: await this.preferenceRepository.get(userId), at: now }
      this.preferences.set(userId, remembered)
    }

    return remembered.value[category]
  }

  private isOverCap(userId: string, category: NotificationCategory): boolean {
    const key = `${userId}|${category}`
    const now = this.clock.now().getTime()
    const recent = (this.recent.get(key) ?? []).filter((at) => now - at < MINUTE_MS)

    if (recent.length >= this.config.capPerMinute) {
      this.recent.set(key, recent)

      return true
    }
    this.recent.set(key, [...recent, now])

    return false
  }

  private tell(notification: Notification): void {
    const view = toView(notification)

    this.listeners.forEach((listener) => listener(notification.userId, view))
  }
}

const sum = (byCategory: Partial<Record<NotificationCategory, number>>) =>
  Object.values(byCategory).reduce((total, count) => total + count, 0)
