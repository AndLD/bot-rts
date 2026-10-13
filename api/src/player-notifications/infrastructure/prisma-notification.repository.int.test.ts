import { randomUUID } from 'crypto'
import { buildUser } from '../../../tests/integration/builders'
import { createTestDatabase, TestDatabase } from '../../../tests/integration/test-database'
import { ALL_NOTIFICATIONS_ON } from '../../../../lib/utils/interfaces/notifications'
import { PrismaUserRepository } from '../../users/infrastructure/prisma-user.repository'
import { Notification } from '../domain/notification'
import { PrismaNotificationPreferenceRepository } from './prisma-notification-preference.repository'
import { PrismaNotificationRepository } from './prisma-notification.repository'

let database: TestDatabase
let userId: string
let otherId: string
let repository: PrismaNotificationRepository
const t0 = new Date('2026-10-13T10:00:00Z')
const at = (seconds: number) => new Date(t0.getTime() + seconds * 1000)

function notification(overrides: Partial<Notification> = {}): Notification {
  return {
    id: randomUUID(),
    userId,
    category: 'damage',
    kind: 'moduleBroken',
    params: { module: 'drill' },
    botId: 'bot-1',
    count: 1,
    createdAt: t0,
    deliveredAt: t0,
    readAt: null,
    ...overrides
  }
}

beforeAll(async () => {
  database = await createTestDatabase()
})
beforeEach(async () => {
  await database.reset()
  const [alice, bob] = [buildUser(), buildUser()]
  await new PrismaUserRepository(database.client).add(alice)
  await new PrismaUserRepository(database.client).add(bob)
  userId = alice.id
  otherId = bob.id
  repository = new PrismaNotificationRepository(database.client)
})
afterAll(() => database.drop())

describe('PrismaNotificationRepository', () => {
  it('stores a notification and lists the newest first, a page at a time', async () => {
    const [a, b, c] = [
      notification({ createdAt: at(1) }),
      notification({ createdAt: at(2) }),
      notification({ createdAt: at(3) })
    ]
    for (const item of [a, c, b]) {
      await repository.add(item)
    }

    expect((await repository.list(userId, { limit: 2, isUnreadOnly: false })).map((n) => n.id)).toEqual([c.id, b.id])
    expect((await repository.list(userId, { limit: 5, before: at(2), isUnreadOnly: false })).map((n) => n.id)).toEqual([
      a.id
    ])
    expect(await repository.list(otherId, { limit: 5, isUnreadOnly: false })).toEqual([])
    expect((await repository.list(userId, { limit: 1, isUnreadOnly: false }))[0]).toEqual(c)
  })

  it('lists only what was delivered, and only the unread when asked', async () => {
    const pending = notification({ deliveredAt: null, createdAt: at(10) })
    const read = notification({ readAt: at(5) })
    const unread = notification({ createdAt: at(1) })
    for (const item of [pending, read, unread]) {
      await repository.add(item)
    }

    expect((await repository.list(userId, { limit: 9, isUnreadOnly: false })).map((n) => n.id).sort()).toEqual(
      [read.id, unread.id].sort()
    )
    expect((await repository.list(userId, { limit: 9, isUnreadOnly: true })).map((n) => n.id)).toEqual([unread.id])
  })

  it('counts one more of an unread notification and moves it, but not of one that was read', async () => {
    const open = notification()
    const closed = notification({ readAt: at(1) })
    await repository.add(open)
    await repository.add(closed)

    expect(await repository.bump(open.id, at(30))).toMatchObject({ id: open.id, count: 2, createdAt: at(30) })
    expect(await repository.bump(closed.id, at(30))).toBeNull()
    expect(await repository.bump(randomUUID(), at(30))).toBeNull()
  })

  it('hands what is due to one taker only, once, oldest first', async () => {
    const early = notification({ deliveredAt: null, createdAt: at(1) })
    const late = notification({ deliveredAt: null, createdAt: at(2) })
    const future = notification({ deliveredAt: null, createdAt: at(100) })
    const done = notification()
    for (const item of [late, future, early, done]) {
      await repository.add(item)
    }

    const [first, second] = await Promise.all([repository.claimDue(at(10), 10), repository.claimDue(at(10), 10)])

    expect([first, second].flat().map((n) => n.id)).toEqual([early.id, late.id])
    expect([first, second].flat().every((n) => n.deliveredAt?.getTime() === at(10).getTime())).toBe(true)
    expect(await repository.claimDue(at(10), 10)).toEqual([])
    expect((await repository.claimDue(at(200), 10)).map((n) => n.id)).toEqual([future.id])
  })

  it('claims at most the limit', async () => {
    for (let index = 0; index < 3; index++) {
      await repository.add(notification({ deliveredAt: null, createdAt: at(index) }))
    }

    expect(await repository.claimDue(at(10), 2)).toHaveLength(2)
  })

  it('counts the unread by category, delivered ones only', async () => {
    await repository.add(notification())
    await repository.add(notification())
    await repository.add(notification({ category: 'attacks', kind: 'underAttack' }))
    await repository.add(notification({ readAt: at(1) }))
    await repository.add(notification({ deliveredAt: null }))
    await repository.add(notification({ userId: otherId }))
    await database.client.playerNotification.create({
      data: { id: randomUUID(), userId, category: 'retired', kind: 'x', params: {}, createdAt: t0, deliveredAt: t0 }
    })

    expect(await repository.unreadByCategory(userId)).toEqual({ damage: 2, attacks: 1 })
  })

  it('marks as read the given ones or all, of the player only', async () => {
    const [a, b] = [notification(), notification()]
    const foreign = notification({ userId: otherId })
    for (const item of [a, b, foreign]) {
      await repository.add(item)
    }

    expect(await repository.markRead(userId, [a.id, foreign.id], at(5))).toBe(1)
    expect(await repository.markRead(userId, [a.id], at(6))).toBe(0)
    expect(await repository.markRead(userId, null, at(7))).toBe(1)
    expect(await repository.unreadByCategory(otherId)).toEqual({ damage: 1 })
    expect(
      (await repository.list(userId, { limit: 5, isUnreadOnly: false })).find((n) => n.id === a.id)?.readAt
    ).toEqual(at(5))
  })

  it('forgets what is older than a date, and goes with the player', async () => {
    await repository.add(notification({ createdAt: at(-1000) }))
    await repository.add(notification({ createdAt: at(1000) }))

    expect(await repository.deleteOlderThan(at(0))).toBe(1)

    await database.client.user.delete({ where: { id: userId } })
    expect(await database.client.playerNotification.count()).toBe(0)
  })
})

describe('PrismaNotificationPreferenceRepository', () => {
  it('has every category on until the player switches one off, and keeps the other settings', async () => {
    const preferences = new PrismaNotificationPreferenceRepository(database.client, () => t0)
    expect(await preferences.get(userId)).toEqual(ALL_NOTIFICATIONS_ON)

    await preferences.save(userId, { ...ALL_NOTIFICATIONS_ON, trade: false })
    await database.client.userSetting.update({ where: { userId }, data: { reducedMotion: true } })
    await preferences.save(userId, { ...ALL_NOTIFICATIONS_ON, trade: false, attacks: false })

    expect(await preferences.get(userId)).toEqual({ ...ALL_NOTIFICATIONS_ON, trade: false, attacks: false })
    expect((await database.client.userSetting.findUniqueOrThrow({ where: { userId } })).reducedMotion).toBe(true)
  })
})
