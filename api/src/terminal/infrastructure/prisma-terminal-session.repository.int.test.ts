import { randomUUID } from 'crypto'
import { TERMINAL_LOG_KIND } from '../../../../lib/utils/interfaces/terminal'
import { buildBase, buildUser } from '../../../tests/integration/builders'
import { createTestDatabase, TestDatabase } from '../../../tests/integration/test-database'
import { PrismaBotRepository } from '../../bots/infrastructure/prisma-bot.repository'
import { PrismaUserRepository } from '../../users/infrastructure/prisma-user.repository'
import { TerminalLogEntry, TerminalSession } from '../domain/terminal-session'
import { PrismaTerminalSessionRepository } from './prisma-terminal-session.repository'

let database: TestDatabase
let repository: PrismaTerminalSessionRepository
let userId: string
let botId: string
let session: TerminalSession

const at = (seconds: number) => new Date(Date.UTC(2026, 0, 1, 0, 0, seconds))

function line(offset: number, overrides: Partial<TerminalLogEntry> = {}): TerminalLogEntry {
  return {
    id: randomUUID(),
    sessionId: session.id,
    botId,
    at: at(offset),
    kind: TERMINAL_LOG_KIND.OUTPUT,
    text: `line ${offset}`,
    ...overrides
  }
}

beforeAll(async () => {
  database = await createTestDatabase()
  repository = new PrismaTerminalSessionRepository(database.client)
})
beforeEach(async () => {
  await database.reset()
  const user = buildUser()
  await new PrismaUserRepository(database.client).add(user)
  const base = buildBase(user.id)
  await new PrismaBotRepository(database.client).add(base)
  userId = user.id
  botId = base.id
  session = { id: randomUUID(), botId, userId, startedAt: at(0), endedAt: null }
  await repository.add(session)
})
afterAll(() => database.drop())

describe('PrismaTerminalSessionRepository', () => {
  it('finds the session of a bot that started last', async () => {
    const newer = { ...session, id: randomUUID(), startedAt: at(5) }
    await repository.add(newer)

    expect(await repository.findLatestOfBot(botId)).toEqual(newer)
    expect(await repository.findLatestOfBot(randomUUID())).toBeNull()
  })

  it('stores, finds and closes a session', async () => {
    expect(await repository.findById(session.id)).toEqual(session)
    expect(await repository.findById(randomUUID())).toBeNull()

    await repository.close(session.id, at(60))

    expect((await repository.findById(session.id))?.endedAt).toEqual(at(60))
  })

  it('lists the newest lines of a bot, oldest first', async () => {
    const lines = [line(1), line(2), line(3)]
    for (const entry of lines) {
      await repository.appendLog(entry)
    }

    expect(await repository.listLogsOfBot(botId, 2)).toEqual([lines[1], lines[2]])
    expect(await repository.listLogsOfBot(randomUUID(), 2)).toEqual([])
  })

  it('drops lines of the given kinds older than a date', async () => {
    const [oldOutput, oldAlarm, fresh] = [line(1), line(2, { kind: TERMINAL_LOG_KIND.SECURITY }), line(100)]
    for (const entry of [oldOutput, oldAlarm, fresh]) {
      await repository.appendLog(entry)
    }

    await repository.deleteLogsOlderThan([TERMINAL_LOG_KIND.OUTPUT], at(50))

    expect(await repository.listLogsOfBot(botId, 10)).toEqual([oldAlarm, fresh])
  })

  it('keeps the newest ordinary lines of a bot and never counts or drops security events', async () => {
    const alarm = line(0, { kind: TERMINAL_LOG_KIND.SECURITY })
    const lines = [line(1), line(2), line(3)]
    for (const entry of [alarm, ...lines]) {
      await repository.appendLog(entry)
    }

    await repository.deleteOldestOrdinaryLogs(botId, 5)
    expect(await repository.listLogsOfBot(botId, 10)).toHaveLength(4)

    await repository.deleteOldestOrdinaryLogs(botId, 2)
    expect(await repository.listLogsOfBot(botId, 10)).toEqual([alarm, lines[1], lines[2]])
  })

  it('removes sessions and lines together with the bot', async () => {
    await repository.appendLog(line(1))
    await database.client.bot.delete({ where: { id: botId } })

    expect(await database.client.terminalSession.count()).toBe(0)
    expect(await database.client.terminalLog.count()).toBe(0)
  })
})
