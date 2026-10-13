import { GameEvent } from '../../engine/domain/game-event'
import { ValidationError } from '../../shared/domain/errors'
import { Notification } from '../domain/notification'
import { DEFAULT_PLAYER_NOTIFICATIONS } from '../domain/notification-policy'
import {
  ALL_NOTIFICATIONS_ON,
  NotificationCategory,
  NotificationPreferences
} from '../../../../lib/utils/interfaces/notifications'
import { ListQuery, NotificationPreferenceRepository, NotificationRepository } from './notification.repository'
import { NotificationService } from './notification.service'

class FakeRepository implements NotificationRepository {
  rows: Notification[] = []
  failOnAdd = false

  async add(notification: Notification) {
    if (this.failOnAdd) {
      throw new Error('database is down')
    }
    this.rows.push(notification)
  }

  async bump(id: string, at: Date) {
    const index = this.rows.findIndex((row) => row.id === id && row.readAt === null)
    if (index < 0) {
      return null
    }
    this.rows[index] = { ...this.rows[index], count: this.rows[index].count + 1, createdAt: at }
    return this.rows[index]
  }

  async claimDue(now: Date) {
    const due = this.rows.filter((row) => row.deliveredAt === null && row.createdAt <= now)
    this.rows = this.rows.map((row) => (due.includes(row) ? { ...row, deliveredAt: now } : row))
    return this.rows.filter((row) => due.some((d) => d.id === row.id))
  }

  async list(userId: string, query: ListQuery) {
    return this.rows
      .filter((row) => row.userId === userId && row.deliveredAt !== null)
      .filter((row) => !query.isUnreadOnly || row.readAt === null)
      .filter((row) => !query.before || row.createdAt < query.before)
      .slice(0, query.limit)
  }

  async unreadByCategory(userId: string) {
    const counts: Partial<Record<NotificationCategory, number>> = {}
    for (const row of this.rows.filter((r) => r.userId === userId && r.deliveredAt && !r.readAt)) {
      counts[row.category] = (counts[row.category] ?? 0) + 1
    }
    return counts
  }

  async markRead(userId: string, ids: readonly string[] | null, at: Date) {
    let marked = 0
    this.rows = this.rows.map((row) => {
      if (row.userId === userId && !row.readAt && (!ids || ids.includes(row.id))) {
        marked += 1
        return { ...row, readAt: at }
      }
      return row
    })
    return marked
  }

  async deleteOlderThan(date: Date) {
    const before = this.rows.length
    this.rows = this.rows.filter((row) => row.createdAt >= date)
    return before - this.rows.length
  }
}

class FakePreferences implements NotificationPreferenceRepository {
  value: NotificationPreferences = { ...ALL_NOTIFICATIONS_ON }
  reads = 0

  async get() {
    this.reads += 1
    return this.value
  }

  async save(_userId: string, preferences: NotificationPreferences) {
    this.value = preferences
  }
}

const config = { ...DEFAULT_PLAYER_NOTIFICATIONS, capPerMinute: 3 }

function setup(capPerMinute = config.capPerMinute) {
  let now = new Date('2026-10-13T10:00:00Z').getTime()
  const repository = new FakeRepository()
  const preferences = new FakePreferences()
  let counter = 0
  const logger = { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() }
  const service = new NotificationService(
    repository,
    preferences,
    { now: () => new Date(now) },
    { next: () => `n${++counter}` },
    logger as never,
    { ...config, capPerMinute }
  )
  const told: Array<[string, string, number]> = []
  service.onNotification((userId, notification) => told.push([userId, notification.id, notification.count]))

  return { service, repository, preferences, logger, told, advance: (ms: number) => (now += ms), now: () => now }
}

const parties = (userId = 'alice', botId = 'b1') => [{ userId, botId }] as GameEvent['parties']
const energyLow = (userId = 'alice', botId = 'b1'): GameEvent => ({
  type: 'EnergyLow',
  at: 1,
  parties: parties(userId, botId)
})
const broken = (n: number): GameEvent => ({ type: 'ModuleBroken', at: 1, parties: parties(), moduleId: `m${n}` })

describe('NotificationService', () => {
  it('stores and tells a notification a player earns from an event, and nothing for another player who only saw it', async () => {
    const { service, repository, told } = setup()

    await service.consume('alice', broken(1))
    await service.consume('bob', broken(1))

    expect(repository.rows).toEqual([
      expect.objectContaining({
        userId: 'alice',
        category: 'damage',
        kind: 'moduleBroken',
        botId: 'b1',
        count: 1,
        readAt: null
      })
    ])
    expect(told).toEqual([['alice', 'n1', 1]])
  })

  it('coalesces repeated events of one kind about one bot into one notification with a count', async () => {
    const { service, repository, told, advance } = setup()

    await service.consume('alice', energyLow())
    advance(5000)
    await service.consume('alice', energyLow())
    await service.consume('alice', energyLow())

    expect(repository.rows).toHaveLength(1)
    expect(repository.rows[0].count).toBe(3)
    expect(told).toEqual([
      ['alice', 'n1', 1],
      ['alice', 'n1', 2],
      ['alice', 'n1', 3]
    ])
  })

  it('starts a new notification after the window, for another bot, and when the old one was read', async () => {
    const { service, repository, advance } = setup(100)

    await service.consume('alice', energyLow())
    await service.consume('alice', energyLow('alice', 'b2'))
    expect(repository.rows).toHaveLength(2)

    advance(config.coalesceMs + 1)
    await service.consume('alice', energyLow())
    expect(repository.rows).toHaveLength(3)

    await service.markRead('alice')
    await service.consume('alice', energyLow())
    expect(repository.rows).toHaveLength(4)
  })

  it('drops what a category sends past its per-minute cap, until the minute is over', async () => {
    const { service, repository, advance } = setup()

    for (let index = 0; index < 5; index++) {
      await service.consume('alice', broken(index))
    }
    expect(repository.rows).toHaveLength(3)

    advance(61_000)
    await service.consume('alice', broken(9))
    expect(repository.rows).toHaveLength(4)
  })

  it('does not count the repeats of a coalesced notification against the cap', async () => {
    const { service, repository } = setup()

    for (let index = 0; index < 10; index++) {
      await service.consume('alice', energyLow())
    }

    expect(repository.rows).toHaveLength(1)
    expect(repository.rows[0].count).toBe(10)
  })

  it('keeps the caps of two players and two categories apart', async () => {
    const { service, repository } = setup()

    for (let index = 0; index < 3; index++) {
      await service.consume('alice', broken(index))
    }
    await service.consume(
      'bob',
      broken(1).type === 'ModuleBroken' ? { ...broken(1), parties: parties('bob') } : broken(1)
    )
    await service.consume('alice', { type: 'BotAssembled', at: 1, parties: parties(), newBotId: 'n' })

    expect(repository.rows).toHaveLength(5)
  })

  it('says nothing about a category the player switched off', async () => {
    const { service, repository, preferences } = setup()
    await service.updatePreferences('alice', { damage: false })

    await service.consume('alice', broken(1))
    await service.consume('alice', { type: 'BotAssembled', at: 1, parties: parties(), newBotId: 'n' })

    expect(preferences.value.damage).toBe(false)
    expect(repository.rows.map((row) => row.kind)).toEqual(['botAssembled'])
  })

  it('remembers the preferences for a moment instead of reading them for every event', async () => {
    const { service, preferences, advance } = setup()

    await service.consume('alice', broken(1))
    await service.consume('alice', broken(2))
    expect(preferences.reads).toBe(1)

    advance(11_000)
    await service.consume('alice', broken(3))
    expect(preferences.reads).toBe(2)
  })

  it('stores a notification for something that finishes later, and tells of it when its time has come', async () => {
    const { service, repository, told, now, advance } = setup()
    const craft: GameEvent = {
      type: 'CraftOrdered',
      at: 1,
      parties: parties(),
      module: 'drill',
      count: 2,
      readyAt: now() + 5000
    }

    await service.consume('alice', craft)
    expect(repository.rows[0]).toMatchObject({ kind: 'craftDone', deliveredAt: null })
    expect(told).toEqual([])
    expect((await service.list('alice', {})).items).toEqual([])

    await service.deliverDue()
    expect(told).toEqual([])

    advance(6000)
    await service.deliverDue()

    expect(told).toEqual([['alice', 'n1', 1]])
    expect((await service.list('alice', {})).items).toHaveLength(1)
  })

  it('tells at once of something that finished before the event arrived', async () => {
    const { service, told, now } = setup()

    await service.consume('alice', {
      type: 'ResearchOrdered',
      at: 1,
      parties: parties(),
      module: 'gun',
      readyAt: now() - 10
    })

    expect(told).toHaveLength(1)
  })

  it('tells of an achievement', async () => {
    const { service, repository } = setup()

    await service.achievementUnlocked('alice', {
      id: 'prospector.1',
      family: 'prospector',
      level: 1,
      levels: 3,
      threshold: 100,
      unlockedAt: 1
    })

    expect(repository.rows[0]).toMatchObject({
      category: 'achievements',
      kind: 'achievementUnlocked',
      params: { family: 'prospector', level: 1, levels: 3, threshold: 100 },
      botId: null
    })
  })

  it('logs a failure to store and goes on', async () => {
    const { service, repository, logger } = setup()
    repository.failOnAdd = true

    await expect(service.consume('alice', broken(1))).resolves.toBeUndefined()

    expect(logger.error).toHaveBeenCalled()
  })

  it('stops telling a listener that unsubscribed', async () => {
    const { service } = setup()
    const heard = jest.fn()
    service.onNotification(heard)()

    await service.consume('alice', broken(1))

    expect(heard).not.toHaveBeenCalled()
  })

  describe('reading', () => {
    it('lists the newest first with the unread count, a page at a time, and only the unread when asked', async () => {
      const { service, advance } = setup()
      for (let index = 0; index < 3; index++) {
        await service.consume('alice', broken(index))
        advance(1000)
      }
      const first = await service.list('alice', { limit: 2 })
      await service.markRead('alice', [first.items[0].id])

      expect(first.items).toHaveLength(2)
      expect(first.unread).toBe(3)
      expect(await service.list('alice', { isUnreadOnly: true })).toMatchObject({ unread: 2 })
      expect((await service.list('alice', { isUnreadOnly: true })).items.every((item) => item.readAt === null)).toBe(
        true
      )
      const older = await service.list('alice', { before: first.items[1].createdAt })
      expect(older.items.every((item) => item.createdAt < first.items[1].createdAt)).toBe(true)
    })

    it('clamps the size of a page', async () => {
      const { service, repository } = setup()
      const list = jest.spyOn(repository, 'list')

      await service.list('alice', { limit: 100000 })
      await service.list('alice', { limit: 0 })

      expect(list.mock.calls.map(([, query]) => query.limit)).toEqual([100, 1])
    })

    it('summarises what waits unread, by category', async () => {
      const { service } = setup()
      await service.consume('alice', broken(1))
      await service.consume('alice', broken(2))
      await service.consume('alice', { type: 'BotAssembled', at: 1, parties: parties(), newBotId: 'n' })

      expect(await service.summary('alice')).toEqual({ unread: 3, byCategory: { damage: 2, fabrication: 1 } })
      expect(await service.summary('bob')).toEqual({ unread: 0, byCategory: {} })
    })

    it("marks given notifications or all of them as read, only the player's own", async () => {
      const { service } = setup()
      await service.consume('alice', broken(1))
      await service.consume('alice', broken(2))
      await service.consume('bob', { ...broken(1), parties: parties('bob') } as GameEvent)

      expect(await service.markRead('alice', ['n1'])).toBe(1)
      expect(await service.markRead('alice', ['n3'])).toBe(0)
      expect(await service.markRead('alice')).toBe(1)
      expect((await service.summary('bob')).unread).toBe(1)
    })
  })

  describe('preferences', () => {
    it('are all on for a player who never set them, and change one at a time', async () => {
      const { service } = setup()

      expect((await service.getPreferences('alice')).categories).toEqual(ALL_NOTIFICATIONS_ON)
      expect((await service.updatePreferences('alice', { trade: false })).categories).toEqual({
        ...ALL_NOTIFICATIONS_ON,
        trade: false
      })
      expect((await service.updatePreferences('alice', { attacks: false })).categories).toMatchObject({
        trade: false,
        attacks: false
      })
    })

    it.each([{ nonsense: true }, { trade: 'yes' }])('refuse %j', async (patch) => {
      const { service } = setup()

      await expect(service.updatePreferences('alice', patch)).rejects.toThrow(ValidationError)
    })
  })

  describe('housekeeping', () => {
    it('forgets notifications older than the retention', async () => {
      const { service, repository, advance } = setup()
      await service.consume('alice', broken(1))
      advance(config.retentionDays * 24 * 3600 * 1000 + 1000)
      await service.consume('alice', broken(2))

      expect(await service.purge()).toBe(1)
      expect(repository.rows).toHaveLength(1)
    })

    it('does not let what it remembers grow: coalescing, caps and preferences are forgotten when stale', async () => {
      const { service, preferences, advance } = setup()
      await service.consume('alice', energyLow())
      advance(61_000)

      await service.deliverDue()
      await service.consume('alice', energyLow())

      expect(preferences.reads).toBe(2)
    })
  })
})
