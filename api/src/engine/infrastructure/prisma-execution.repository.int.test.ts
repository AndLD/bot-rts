import { randomUUID } from 'crypto'
import { buildBase, buildUser } from '../../../tests/integration/builders'
import { createTestDatabase, TestDatabase } from '../../../tests/integration/test-database'
import { PrismaBotRepository } from '../../bots/infrastructure/prisma-bot.repository'
import { PrismaUserRepository } from '../../users/infrastructure/prisma-user.repository'
import { Execution, ExecutionStatus } from '../domain/execution'
import { PrismaExecutionRepository } from './prisma-execution.repository'

let database: TestDatabase
let userId: string
let botId: string

const execution = (overrides: Partial<Execution> = {}): Execution => ({
  id: randomUUID(),
  botId,
  userId,
  file: '/memory/main.js',
  args: [1, 'two', { three: 3 }],
  status: ExecutionStatus.ACTIVE,
  restarts: 0,
  reason: null,
  createdAt: new Date('2026-10-12T10:00:00.000Z'),
  endedAt: null,
  ...overrides
})

beforeAll(async () => {
  database = await createTestDatabase()
})
beforeEach(async () => {
  await database.reset()
  const user = buildUser()
  await new PrismaUserRepository(database.client).add(user)
  const base = buildBase(user.id)
  await new PrismaBotRepository(database.client).add(base)
  userId = user.id
  botId = base.id
})
afterAll(() => database.drop())

describe('PrismaExecutionRepository', () => {
  it('stores an execution with its arguments and finds it again', async () => {
    const executions = new PrismaExecutionRepository(database.client)
    const stored = execution()

    await executions.add(stored)

    expect(await executions.findById(stored.id)).toEqual(stored)
    expect(await executions.findById(randomUUID())).toBeNull()
  })

  it('updates the status, the reason and the restart count', async () => {
    const executions = new PrismaExecutionRepository(database.client)
    const stored = execution()
    await executions.add(stored)

    const ended = { ...stored, status: ExecutionStatus.KILLED, reason: 'killed', restarts: 2, endedAt: new Date() }
    await executions.update(ended)

    expect(await executions.findById(stored.id)).toEqual(ended)
  })

  it('lists the active executions oldest first', async () => {
    const executions = new PrismaExecutionRepository(database.client)
    const newer = execution({ createdAt: new Date('2026-10-12T11:00:00.000Z') })
    const older = execution()
    await executions.add(newer)
    await executions.add(older)
    await executions.add(execution({ status: ExecutionStatus.FINISHED }))
    await executions.add(execution({ status: ExecutionStatus.KILLED }))

    expect((await executions.listActive()).map((e) => e.id)).toEqual([older.id, newer.id])
  })

  it('disappears with its bot', async () => {
    const executions = new PrismaExecutionRepository(database.client)
    const stored = execution()
    await executions.add(stored)

    await database.client.bot.delete({ where: { id: botId } })

    expect(await executions.findById(stored.id)).toBeNull()
  })
})
