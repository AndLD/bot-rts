import { Test } from '@nestjs/testing'
import { createTestDatabase, TestDatabase } from '../../tests/integration/test-database'
import { urlForDatabase } from '../../tests/integration/database-url'
import { buildUser } from '../../tests/integration/builders'
import { BotsService } from '../bots/application/bots.service'
import { loadConfig } from '../config/app-config'
import { FilesService } from '../files/application/files.service'
import { ModuleFactory } from '../modules/application/module.factory'
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
afterEach(async () => {
  // Whatever a test left running is stopped, so that nothing keeps writing to a database that is about to go
  for (const stop of running.splice(0)) {
    await stop()
  }
})
afterAll(() => database.drop())

const running: Array<() => Promise<void>> = []

function channel() {
  const toEngine: Array<(message: ControlMessage) => void> = []
  const fromEngine: EngineMessage[] = []
  const link: MessageChannel<ControlMessage, EngineMessage> = {
    post: (message) => void fromEngine.push(message),
    onMessage: (handler) => void toEngine.push(handler)
  }
  return { link, fromEngine, send: (message: ControlMessage) => toEngine.forEach((handler) => handler(message)) }
}

async function until(condition: () => boolean | Promise<boolean>, what: string) {
  const deadline = Date.now() + 15000
  while (!(await condition())) {
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
    running.push(async () => {
      send({ kind: 'stop' })
      await until(() => fromEngine.some((m) => m.kind === 'stopped'), 'the stop')
      await app.close()
    })
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
    await until(async () => (await database.client.execution.count({ where: { status: 'finished' } })) === 1, 'the end')
  })

  it('moves a bot in memory and writes the new place and heading to the database behind', async () => {
    const [{ db }] = await database.client.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`
    const config = loadConfig({
      DATABASE_URL: urlForDatabase(db),
      NODE_ENV: 'test',
      ENGINE_TICK_INTERVAL_MS: '10',
      ENGINE_FLUSH_EVERY_TICKS: '2',
      // No deposit may block the way
      WORLD_RESOURCE_CHANCE: '0'
    })
    const { link, fromEngine, send } = channel()
    const app = await Test.createTestingModule({ imports: [EngineWorkerModule.register(config, link)] }).compile()
    running.push(async () => {
      send({ kind: 'stop' })
      await until(() => fromEngine.some((m) => m.kind === 'stopped'), 'the stop')
      await app.close()
    })
    const user = buildUser()
    await new PrismaUserRepository(database.client).add(user)
    const bots = app.get(BotsService)
    const { bot: base } = await bots.deployUserBase(user, { password: 'secret1', location: { x: 20, y: 20, z: 0 } })
    const factory = app.get(ModuleFactory)
    const { bot: rover } = await bots.createBot(user.id, {
      baseId: base.id,
      label: 'Rover',
      modules: [
        'processor-class1',
        'wireless-adapter-class1',
        'battery-class1',
        'memory-class1',
        'engine-class1',
        'wheels-class1'
      ].map((name) => factory.template(name))
    })
    const files = app.get(FilesService)
    const [drive] = await files.listDrives(user.id, rover.id)
    await files.write(
      user.id,
      rover.id,
      drive.id,
      'go.js',
      'export async function main(bot) { await bot.turn("right"); const r = await bot.move(1); bot.log(r.ok, r.ok ? r.data.moved : r.code) }'
    )
    // Open ground, whatever cell next to the base the rover was given
    await database.client.mapPoint.updateMany({ where: { contentId: rover.id }, data: { x: 40, y: 40 } })
    const before = await database.client.mapPoint.findFirstOrThrow({ where: { contentId: rover.id } })

    await app.get(EngineHost).start()
    send({
      kind: 'request',
      id: 1,
      request: { op: 'start', request: { userId: user.id, botId: rover.id, file: '/memory-class1/go.js', args: [] } }
    })
    await until(() => fromEngine.some((m) => m.kind === 'event' && m.event.type === 'log'), 'the move')
    await until(
      async () => (await database.client.bot.findUniqueOrThrow({ where: { id: rover.id } })).heading === 1,
      'the flush'
    )

    const logged = fromEngine.flatMap((m) => (m.kind === 'event' && m.event.type === 'log' ? [m.event.text] : []))
    expect(logged).toEqual(['true 1'])
    const after = await database.client.mapPoint.findFirstOrThrow({ where: { contentId: rover.id } })
    expect([after.x, after.y]).toEqual([before.x + 1, before.y])
    expect(
      await database.client.mapPoint.findFirst({ where: { x: before.x, y: before.y, contentId: rover.id } })
    ).toBeNull()
  })

  it('keeps the area of a live scanner current for the player, tells them in batches and writes what they saw', async () => {
    const [{ db }] = await database.client.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`
    const config = loadConfig({
      DATABASE_URL: urlForDatabase(db),
      NODE_ENV: 'test',
      ENGINE_TICK_INTERVAL_MS: '10',
      ENGINE_FLUSH_EVERY_TICKS: '2',
      WORLD_RESOURCE_CHANCE: '0'
    })
    const { link, fromEngine, send } = channel()
    const app = await Test.createTestingModule({ imports: [EngineWorkerModule.register(config, link)] }).compile()
    running.push(async () => {
      send({ kind: 'stop' })
      await until(() => fromEngine.some((m) => m.kind === 'stopped'), 'the stop')
      await app.close()
    })
    const user = buildUser()
    await new PrismaUserRepository(database.client).add(user)
    const bots = app.get(BotsService)
    const { bot: base } = await bots.deployUserBase(user, { password: 'secret1', location: { x: 20, y: 20, z: 0 } })
    const factory = app.get(ModuleFactory)
    const { bot: watcher } = await bots.createBot(user.id, {
      baseId: base.id,
      label: 'Watcher',
      modules: ['processor-class1', 'wireless-adapter-class1', 'battery-class1', 'memory-class1', 'scanner-class1'].map(
        (name) => factory.template(name)
      )
    })
    await database.client.mapPoint.updateMany({ where: { contentId: watcher.id }, data: { x: 60, y: 60 } })
    const files = app.get(FilesService)
    const [drive] = await files.listDrives(user.id, watcher.id)
    await files.write(
      user.id,
      watcher.id,
      drive.id,
      'watch.js',
      'export async function main(bot) { const s = bot.modules.find((m) => m.type === "scanner"); const e = await bot.enable(s.id); await sleep(400); const v = await bot.view(); bot.log(e.ok, v.ok, v.data.cells.length) }'
    )

    await app.get(EngineHost).start()
    send({
      kind: 'request',
      id: 1,
      request: {
        op: 'start',
        request: { userId: user.id, botId: watcher.id, file: '/memory-class1/watch.js', args: [] }
      }
    })
    await until(() => fromEngine.some((m) => m.kind === 'event' && m.event.type === 'log'), 'the view')
    await until(
      async () => (await database.client.knownPoint.count({ where: { userId: user.id } })) >= 9,
      'the knowledge'
    )

    const log = fromEngine.flatMap((m) => (m.kind === 'event' && m.event.type === 'log' ? [m.event.text] : []))
    expect(log).toEqual(['true true 9'])
    const batches = fromEngine.flatMap((m) => (m.kind === 'event' && m.event.type === 'vision' ? [m.event] : []))
    expect(batches[0]).toMatchObject({ userId: user.id, botId: watcher.id })
    expect(batches[0].cells).toHaveLength(9)
    expect(await database.client.knownPoint.count({ where: { userId: user.id, x: { gte: 59, lte: 61 } } })).toBe(9)
    expect(
      (await database.client.module.findMany({ where: { botId: watcher.id, type: 'scanner' } }))[0].props
    ).toMatchObject({ isLive: true })
  })

  it("tells a script whether its bot reaches the base over the radio, and keeps the player's map free of what it sees out of reach", async () => {
    const [{ db }] = await database.client.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`
    const config = loadConfig({
      DATABASE_URL: urlForDatabase(db),
      NODE_ENV: 'test',
      ENGINE_TICK_INTERVAL_MS: '10',
      ENGINE_FLUSH_EVERY_TICKS: '2',
      WORLD_RESOURCE_CHANCE: '0'
    })
    const { link, fromEngine, send } = channel()
    const app = await Test.createTestingModule({ imports: [EngineWorkerModule.register(config, link)] }).compile()
    running.push(async () => {
      send({ kind: 'stop' })
      await until(() => fromEngine.some((m) => m.kind === 'stopped'), 'the stop')
      await app.close()
    })
    const user = buildUser()
    await new PrismaUserRepository(database.client).add(user)
    const bots = app.get(BotsService)
    const { bot: base } = await bots.deployUserBase(user, { password: 'secret1', location: { x: 20, y: 20, z: 0 } })
    const factory = app.get(ModuleFactory)
    const kit = ['processor-class1', 'wireless-adapter-class1', 'battery-class1', 'memory-class1', 'scanner-class1']
    const { bot: near } = await bots.createBot(user.id, {
      baseId: base.id,
      label: 'Near',
      modules: kit.map((name) => factory.template(name))
    })
    const { bot: far } = await bots.createBot(user.id, {
      baseId: base.id,
      label: 'Far',
      modules: kit.map((name) => factory.template(name))
    })
    await database.client.mapPoint.updateMany({ where: { contentId: near.id }, data: { x: 28, y: 20 } })
    await database.client.mapPoint.updateMany({ where: { contentId: far.id }, data: { x: 90, y: 90 } })
    const files = app.get(FilesService)
    for (const bot of [near, far]) {
      const [drive] = await files.listDrives(user.id, bot.id)
      await files.write(
        user.id,
        bot.id,
        drive.id,
        'link.js',
        'export async function main(bot) { const s = await bot.getLinkStatus(); const c = await bot.scan(); bot.log(s.data.isConnected, s.data.signal, s.data.hops, c.data.length) }'
      )
    }

    await app.get(EngineHost).start()
    for (const [id, bot] of [near, far].entries()) {
      send({
        kind: 'request',
        id: id + 1,
        request: { op: 'start', request: { userId: user.id, botId: bot.id, file: '/memory-class1/link.js', args: [] } }
      })
    }
    await until(() => fromEngine.filter((m) => m.kind === 'event' && m.event.type === 'log').length === 2, 'both logs')

    const lines = fromEngine.flatMap((m) => (m.kind === 'event' && m.event.type === 'log' ? [m.event.text] : [])).sort()
    expect(lines).toEqual(['false 0 0 9', 'true 3 1 9'])
    // What the far bot scanned does not reach the map of the player: only its neighbours' cells and the base's are known
    await until(async () => (await database.client.knownPoint.count({ where: { userId: user.id } })) >= 10, 'knowledge')
    expect(await database.client.knownPoint.count({ where: { userId: user.id, x: { gte: 89 } } })).toBe(0)
    expect(
      await database.client.knownPoint.count({ where: { userId: user.id, x: { gte: 27, lte: 29 }, y: { lte: 21 } } })
    ).toBeGreaterThan(0)
  })
})
