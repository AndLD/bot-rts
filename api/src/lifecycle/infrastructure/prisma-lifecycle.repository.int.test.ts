import { randomUUID } from 'crypto'
import { TERMINAL_LOG_KIND } from '../../../../lib/utils/interfaces/terminal'
import {
  buildAuthToken,
  buildBase,
  buildCredential,
  buildSession,
  buildUser
} from '../../../tests/integration/builders'
import { createTestDatabase, TestDatabase } from '../../../tests/integration/test-database'
import { PrismaAuthTokenRepository } from '../../auth/infrastructure/prisma-auth-token.repository'
import { PrismaCredentialRepository } from '../../auth/infrastructure/prisma-credential.repository'
import { PrismaSessionRepository } from '../../auth/infrastructure/prisma-session.repository'
import { PrismaBotRepository } from '../../bots/infrastructure/prisma-bot.repository'
import { PrismaUserRepository } from '../../users/infrastructure/prisma-user.repository'
import { User } from '../../users/domain/user.entity'
import { PrismaLifecycleRepository } from './prisma-lifecycle.repository'

let database: TestDatabase
let repository: PrismaLifecycleRepository

const day = (offset: number) => new Date(Date.UTC(2026, 5, 1 + offset))

beforeAll(async () => {
  database = await createTestDatabase()
  repository = new PrismaLifecycleRepository(database.client)
})
beforeEach(() => database.reset())
afterAll(() => database.drop())

async function addUser(overrides: Partial<User> = {}, options: { isVerified?: boolean; lastActive?: Date } = {}) {
  const user = buildUser({ createdAt: day(-400), ...overrides })
  await new PrismaUserRepository(database.client).add(user)
  await new PrismaCredentialRepository(database.client).add(
    buildCredential(user.id, { emailVerified: options.isVerified ?? true })
  )
  if (options.lastActive) {
    await new PrismaSessionRepository(database.client).add(
      buildSession(user.id, { createdAt: options.lastActive, lastUsedAt: options.lastActive })
    )
  }
  return user
}

describe('unverified accounts', () => {
  it('finds old accounts that were never confirmed and own no base, and deletes them with their data', async () => {
    const stale = await addUser({ createdAt: day(-10) }, { isVerified: false })
    const withBase = await addUser({ createdAt: day(-10) }, { isVerified: false })
    await new PrismaBotRepository(database.client).add(buildBase(withBase.id))
    await addUser({ createdAt: day(-10) }, { isVerified: true })
    await addUser({ createdAt: day(-2) }, { isVerified: false })

    const ids = await repository.findStaleUnverifiedUserIds(day(-7), 10)

    expect(ids).toEqual([stale.id])
    expect(await repository.deleteUsers(ids)).toBe(1)
    expect(await database.client.user.count()).toBe(3)
    expect(await database.client.localCredential.count()).toBe(3)
  })

  it('respects the limit and takes the oldest first', async () => {
    const older = await addUser({ createdAt: day(-30) }, { isVerified: false })
    await addUser({ createdAt: day(-20) }, { isVerified: false })

    expect(await repository.findStaleUnverifiedUserIds(day(-7), 1)).toEqual([older.id])
  })
})

describe('inactive accounts', () => {
  it('finds free players of the plain role whose last activity is old and who run no script', async () => {
    const inactive = await addUser({}, { lastActive: day(-340) })
    const neverLoggedIn = await addUser({ createdAt: day(-350) })
    await addUser({}, { lastActive: day(-10) })
    await addUser({ status: 'admin' }, { lastActive: day(-400) })
    await addUser({ subscription: 'monthly' }, { lastActive: day(-400) })
    await addUser({ deletedAt: day(-1) }, { lastActive: day(-400) })
    const running = await addUser({}, { lastActive: day(-400) })
    const base = buildBase(running.id)
    await new PrismaBotRepository(database.client).add(base)
    await database.client.execution.create({
      data: {
        id: randomUUID(),
        botId: base.id,
        userId: running.id,
        file: '/memory/main.js',
        args: [],
        status: 'active',
        createdAt: day(-400)
      }
    })

    const found = await repository.findInactiveAccounts(day(-335), 10)

    expect(found.map((account) => account.userId).sort()).toEqual([inactive.id, neverLoggedIn.id].sort())
    expect(found[0]).toMatchObject({ name: 'Alice', noticeSentAt: null })
  })

  it('remembers the notice, and forgets it for a player who came back afterwards', async () => {
    const stayed = await addUser({}, { lastActive: day(-340) })
    const returned = await addUser({}, { lastActive: day(-340) })
    await repository.markInactivityNotice(stayed.id, day(-5))
    await repository.markInactivityNotice(returned.id, day(-5))
    await new PrismaSessionRepository(database.client).add(
      buildSession(returned.id, { createdAt: day(-2), lastUsedAt: day(-2) })
    )

    expect(await repository.clearNoticesOfReturnedPlayers()).toBe(1)

    const notices = await database.client.user.findMany({ select: { id: true, inactivityNoticeAt: true } })
    expect(notices.find((row) => row.id === stayed.id)?.inactivityNoticeAt).toEqual(day(-5))
    expect(notices.find((row) => row.id === returned.id)?.inactivityNoticeAt).toBeNull()
    const found = await repository.findInactiveAccounts(day(-335), 10)
    expect(found).toEqual([expect.objectContaining({ userId: stayed.id, noticeSentAt: day(-5) })])
  })
})

describe('retention of game data', () => {
  async function setupTerminal() {
    const user = await addUser()
    const bot = buildBase(user.id)
    await new PrismaBotRepository(database.client).add(bot)
    const session = (endedAt: Date | null) =>
      database.client.terminalSession.create({
        data: { id: randomUUID(), botId: bot.id, userId: user.id, startedAt: day(-100), endedAt }
      })
    const log = (sessionId: string, kind: TERMINAL_LOG_KIND, at: Date) =>
      database.client.terminalLog.create({
        data: { id: randomUUID(), sessionId, botId: bot.id, at, kind, text: 'x' }
      })
    return { user, bot, session, log }
  }

  it('drops old lines by kind, and ended sessions that kept no line', async () => {
    const { session, log } = await setupTerminal()
    const old = await session(day(-100))
    const empty = await session(day(-100))
    const open = await session(null)
    await log(old.id, TERMINAL_LOG_KIND.OUTPUT, day(-40))
    await log(old.id, TERMINAL_LOG_KIND.OUTPUT, day(-5))
    await log(old.id, TERMINAL_LOG_KIND.SECURITY, day(-40))

    const ordinary = [TERMINAL_LOG_KIND.INPUT, TERMINAL_LOG_KIND.OUTPUT, TERMINAL_LOG_KIND.ERROR]
    expect(await repository.deleteTerminalLogsOlderThan(ordinary, day(-30))).toBe(1)
    expect(await repository.deleteTerminalLogsOlderThan([TERMINAL_LOG_KIND.SECURITY], day(-90))).toBe(0)
    expect(await repository.deleteEndedTerminalSessionsWithoutLogs(day(-30))).toBe(1)

    const left = (await database.client.terminalSession.findMany()).map((row) => row.id).sort()
    expect(left).toEqual([old.id, open.id].sort())
    expect(left).not.toContain(empty.id)
  })

  it('drops finished executions that ended long ago, never an active one', async () => {
    const user = await addUser()
    const bot = buildBase(user.id)
    await new PrismaBotRepository(database.client).add(bot)
    const execution = (status: 'active' | 'finished' | 'killed', endedAt: Date | null) =>
      database.client.execution.create({
        data: {
          id: randomUUID(),
          botId: bot.id,
          userId: user.id,
          file: 'a.js',
          args: [],
          status,
          createdAt: day(-90),
          endedAt
        }
      })
    await execution('finished', day(-60))
    await execution('killed', day(-60))
    await execution('finished', day(-3))
    await execution('active', null)

    expect(await repository.deleteEndedExecutionsBefore(day(-30))).toBe(2)
    expect(await database.client.execution.count()).toBe(2)
  })

  it('drops expired, revoked and used logins and links', async () => {
    const user = await addUser()
    const sessions = new PrismaSessionRepository(database.client)
    const tokens = new PrismaAuthTokenRepository(database.client)
    await sessions.add(buildSession(user.id, { expiresAt: day(-20) }))
    await sessions.add(buildSession(user.id, { expiresAt: day(30), revokedAt: day(-20) }))
    await sessions.add(buildSession(user.id, { expiresAt: day(30) }))
    await tokens.add(buildAuthToken(user.id, { expiresAt: day(-20) }))
    await tokens.add(buildAuthToken(user.id, { expiresAt: day(30), usedAt: day(-20) }))
    await tokens.add(buildAuthToken(user.id, { expiresAt: day(30) }))

    expect(await repository.deleteExpiredAuthData(day(-7))).toBe(4)
    expect(await database.client.session.count()).toBe(1)
    expect(await database.client.authToken.count()).toBe(1)
  })

  it('deletes the days of activity before the cut-off and keeps the rest', async () => {
    const user = buildUser()
    await new PrismaUserRepository(database.client).add(user)
    await database.client.playerActivity.createMany({
      data: [
        { userId: user.id, day: new Date('2025-01-01') },
        { userId: user.id, day: new Date('2025-06-01') },
        { userId: user.id, day: new Date('2026-01-01') }
      ]
    })

    expect(await repository.deletePlayerActivityBefore(new Date('2025-09-01'))).toBe(2)
    expect(await database.client.playerActivity.count()).toBe(1)
  })
})
