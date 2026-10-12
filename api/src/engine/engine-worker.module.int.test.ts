import { Test } from '@nestjs/testing'
import { createTestDatabase, TestDatabase } from '../../tests/integration/test-database'
import { urlForDatabase } from '../../tests/integration/database-url'
import { buildUser } from '../../tests/integration/builders'
import { BotsService } from '../bots/application/bots.service'
import { loadConfig } from '../config/app-config'
import { FilesService } from '../files/application/files.service'
import { PrismaUserRepository } from '../users/infrastructure/prisma-user.repository'
import { ControlMessage, EngineMessage, MessageChannel } from './application/engine-protocol'
import { EngineWorkerModule } from './engine-worker.module'
import { EngineHost } from './infrastructure/engine-host'

// The engine's wiring, in the test's own process: the same module the engine thread builds, against the real database

let database: TestDatabase

beforeAll(async () => {
  database = await createTestDatabase()
})
beforeEach(() => database.reset())
afterAll(() => database.drop())

function channel() {
  const toEngine: Array<(message: ControlMessage) => void> = []
  const fromEngine: EngineMessage[] = []
  const link: MessageChannel<ControlMessage, EngineMessage> = {
    post: (message) => void fromEngine.push(message),
    onMessage: (handler) => void toEngine.push(handler)
  }
  return { link, fromEngine, send: (message: ControlMessage) => toEngine.forEach((handler) => handler(message)) }
}

async function until(condition: () => boolean, what: string) {
  const deadline = Date.now() + 15000
  while (!condition()) {
    if (Date.now() > deadline) throw new Error(`Timed out waiting for ${what}`)
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
}

describe('EngineWorkerModule', () => {
  it('wires an engine that runs a script from the drives of a bot and answers requests', async () => {
    const [{ db }] = await database.client.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`
    const config = loadConfig({ DATABASE_URL: urlForDatabase(db), NODE_ENV: 'test', ENGINE_TICK_INTERVAL_MS: '10' })
    const { link, fromEngine, send } = channel()
    const app = await Test.createTestingModule({ imports: [EngineWorkerModule.register(config, link)] }).compile()
    const user = buildUser()
    await new PrismaUserRepository(database.client).add(user)
    const { bot } = await app.get(BotsService).deployUserBase(user, { password: 'secret1' })
    const files = app.get(FilesService)
    const [drive] = await files.listDrives(user.id, bot.id)
    await files.write(
      user.id,
      bot.id,
      drive.id,
      'main.js',
      'export async function main(bot, n) { const r = await bot.scan(); bot.log(r.ok, r.data.length, n); const l = await bot.read("/memory-class1/main.js"); bot.log(l.ok) }'
    )

    const host = app.get(EngineHost)
    await host.start()
    send({
      kind: 'request',
      id: 1,
      request: { op: 'start', request: { userId: user.id, botId: bot.id, file: '/memory-class1/main.js', args: [7] } }
    })
    await until(() => fromEngine.some((m) => m.kind === 'reply' && m.id === 1), 'the reply')
    await until(
      () => fromEngine.filter((m) => m.kind === 'event' && m.event.type === 'log').length === 2,
      'the script log'
    )

    expect(fromEngine[0]).toEqual({ kind: 'ready' })
    const lines = fromEngine.flatMap((m) => (m.kind === 'event' && m.event.type === 'log' ? [m.event.text] : []))
    expect(lines).toEqual(['true 9 7', 'true'])
    expect(await database.client.execution.count({ where: { status: 'finished' } })).toBe(1)

    send({ kind: 'stop' })
    await until(() => fromEngine.some((m) => m.kind === 'stopped'), 'the stop')
    await app.close()
  })
})
