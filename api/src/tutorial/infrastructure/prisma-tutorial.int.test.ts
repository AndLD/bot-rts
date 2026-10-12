import { randomUUID } from 'crypto'
import { buildBase, buildModule, buildUser } from '../../../tests/integration/builders'
import { createTestDatabase, TestDatabase } from '../../../tests/integration/test-database'
import { PrismaBotRepository } from '../../bots/infrastructure/prisma-bot.repository'
import { PrismaModuleRepository } from '../../modules/infrastructure/prisma-module.repository'
import { PrismaUserRepository } from '../../users/infrastructure/prisma-user.repository'
import { PrismaTutorialFacts } from './prisma-tutorial-facts'
import { PrismaTutorialProgressRepository } from './prisma-tutorial-progress.repository'

let database: TestDatabase
let userId: string
let baseId: string

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
  baseId = base.id
})
afterAll(() => database.drop())

describe('PrismaTutorialProgressRepository', () => {
  it('reads an untouched tutorial as active with nothing done, and stores what is done', async () => {
    const progress = new PrismaTutorialProgressRepository(database.client)
    expect(await progress.get(userId)).toEqual({ status: 'active', done: [] })

    await progress.save(userId, { status: 'skipped', done: ['scan', 'openTerminal'] })

    expect(await progress.get(userId)).toEqual({ status: 'skipped', done: ['openTerminal', 'scan'] })
  })

  it('ignores a stored status or step it does not know, and leaves the other settings alone', async () => {
    await database.client.userSetting.create({
      data: {
        userId,
        reducedMotion: true,
        tutorial: { status: 'weird', done: ['scan', 'dance'] },
        updatedAt: new Date()
      }
    })
    const progress = new PrismaTutorialProgressRepository(database.client, () => new Date('2026-01-02T00:00:00.000Z'))

    expect(await progress.get(userId)).toEqual({ status: 'active', done: ['scan'] })
    await progress.save(userId, { status: 'completed', done: [] })

    const row = await database.client.userSetting.findUniqueOrThrow({ where: { userId } })
    expect(row.reducedMotion).toBe(true)
    expect(row.updatedAt.toISOString()).toBe('2026-01-02T00:00:00.000Z')
  })
})

describe('PrismaTutorialFacts', () => {
  const facts = () => new PrismaTutorialFacts(database.client).check(userId)
  const done = async () =>
    Object.entries(await facts())
      .filter(([, isDone]) => isDone)
      .map(([step]) => step)

  it('finds nothing done for a player who only deployed a base', async () => {
    await database.client.knownPoint.create({ data: { id: randomUUID(), userId, x: 0, y: 0 } })

    expect(await done()).toEqual([])
  })

  it('finds the terminal opened and the modules listed', async () => {
    const sessionId = randomUUID()
    await database.client.terminalSession.create({
      data: { id: sessionId, botId: baseId, userId, startedAt: new Date() }
    })
    expect(await done()).toEqual(['openTerminal'])

    const log = (text: string) =>
      database.client.terminalLog.create({
        data: { id: randomUUID(), sessionId, botId: baseId, at: new Date(), kind: 'input', text }
      })
    await log('modulesx')
    expect(await done()).toEqual(['openTerminal'])
    await log('modules')
    expect(await done()).toEqual(['openTerminal', 'listModules'])
  })

  it('finds a scan: more is known than the base', async () => {
    await database.client.knownPoint.createMany({
      data: [
        { id: randomUUID(), userId, x: 0, y: 0 },
        { id: randomUUID(), userId, x: 1, y: 0 }
      ]
    })

    expect(await done()).toEqual(['scan'])
  })

  it('finds a script written on a drive of the player, not a directory or another kind of file', async () => {
    const drive = buildModule(baseId, { type: 'drive', name: 'memory-class1' })
    await new PrismaModuleRepository(database.client).addMany([drive])
    const file = (path: string, kind: 'file' | 'directory') =>
      database.client.file.create({ data: { id: randomUUID(), driveId: drive.id, path, kind } })

    await file('scripts.js', 'directory')
    await file('notes.txt', 'file')
    expect(await done()).toEqual([])

    await file('mine.ts', 'file')
    expect(await done()).toEqual(['writeScript'])
  })

  it('finds a script run', async () => {
    await database.client.execution.create({
      data: {
        id: randomUUID(),
        botId: baseId,
        userId,
        file: '/m/a.js',
        args: [],
        status: 'finished',
        createdAt: new Date()
      }
    })

    expect(await done()).toEqual(['runScript'])
  })

  it('finds a crafted module: a part in hand, or a job in the factory', async () => {
    const item = (type: 'part' | 'blueprint') =>
      database.client.item.create({ data: { id: randomUUID(), type, name: 'gun-class1', weight: 1, botId: baseId } })

    await item('blueprint')
    expect(await done()).toEqual([])
    const part = await item('part')
    expect(await done()).toEqual(['craft'])

    await database.client.item.delete({ where: { id: part.id } })
    const factory = buildModule(baseId, { type: 'factory', props: { jobs: [] } })
    await new PrismaModuleRepository(database.client).addMany([factory])
    expect(await done()).toEqual([])
    await database.client.module.update({ where: { id: factory.id }, data: { props: { jobs: [{ kind: 'craft' }] } } })
    expect(await done()).toEqual(['craft'])
  })

  it('finds an assembled bot, which also means something was crafted', async () => {
    await new PrismaBotRepository(database.client).add({
      ...buildBase(userId),
      id: randomUUID(),
      type: 'worker' as never,
      userId: null,
      baseId
    })

    expect(await done()).toEqual(['craft', 'assemble'])
  })

  it("does not count another player's doings", async () => {
    const other = buildUser()
    await new PrismaUserRepository(database.client).add(other)
    await database.client.execution.create({
      data: {
        id: randomUUID(),
        botId: baseId,
        userId: other.id,
        file: '/m/a.js',
        args: [],
        status: 'finished',
        createdAt: new Date()
      }
    })
    await database.client.knownPoint.createMany({
      data: [
        { id: randomUUID(), userId: other.id, x: 0, y: 0 },
        { id: randomUUID(), userId: other.id, x: 1, y: 0 }
      ]
    })

    expect(await done()).toEqual([])
  })
})
