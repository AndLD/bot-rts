import request from 'supertest'
import { RESOURCE } from '../../../lib/utils/interfaces/resources'
import { io as connect, Socket } from 'socket.io-client'
import { createTestDatabase, TestDatabase } from '../../tests/integration/test-database'
import { signUpVerified, startTestApp, TestApp } from '../../tests/integration/test-app'
import { ENGINE_PORT, EnginePort } from './application/engine-port'
import { EngineEvent } from './application/engine-ports'
import { ENGINE_PROCESS } from './engine.module'
import { EngineProcess, WorkerLike } from './infrastructure/engine-process'

// The engine thread for real: a worker with its own application context, talking to PostgreSQL

let database: TestDatabase
let testApp: TestApp
let port: EnginePort
let events: EngineEvent[]

beforeAll(async () => {
  database = await createTestDatabase()
  testApp = await startTestApp(database, {
    ENGINE_ENABLED: 'true',
    ENGINE_TICK_INTERVAL_MS: '20',
    ENGINE_WATCHDOG_STALL_MS: '700',
    ENGINE_WATCHDOG_POLL_MS: '100'
  })
  port = testApp.app.get<EnginePort>(ENGINE_PORT)
  events = []
  port.onEvent((event) => events.push(event))
}, 90000)
beforeEach(() => {
  events.length = 0
})
afterAll(async () => {
  await testApp.close()
  await database.drop()
})

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` })

// The tests share the running engine, so each one has players of its own instead of a database wiped behind its back
let players = 0

async function deployWithScript(source: string) {
  players += 1
  const player = await signUpVerified(testApp, database, `player${players}@example.com`)
  const deployed = await request(testApp.url)
    .post('/api/v1/bots/base')
    .set(bearer(player.accessToken))
    .send({ password: 'secret1' })
    .expect(201)
  const botId = deployed.body.bot._id as string
  const drive = await database.client.module.findFirstOrThrow({ where: { botId, type: 'drive' } })
  await request(testApp.url)
    .put(`/api/v1/bots/${botId}/drives/${drive.id}/file`)
    .set(bearer(player.accessToken))
    .send({ path: 'main.js', content: source })
    .expect(200)
  return { ...player, botId }
}

async function until(condition: () => boolean | Promise<boolean>, what: string, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs
  while (!(await condition())) {
    if (Date.now() > deadline) throw new Error(`Timed out waiting for ${what}`)
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
}

const logsOf = () => events.flatMap((event) => (event.type === 'log' ? [event.text] : []))

describe('the engine as the single writer (design §14.2)', () => {
  it('runs the requests that change the world in the engine thread, and carries its errors back', async () => {
    const act = jest.spyOn(port, 'act')
    const { accessToken, botId } = await deployWithScript('export async function main() {}')

    const scan = await request(testApp.url).post(`/api/v1/bots/${botId}/scan`).set(bearer(accessToken)).expect(200)
    const refused = await request(testApp.url)
      .post(`/api/v1/bots/${botId}/factory/craft`)
      .set(bearer(accessToken))
      .send({ module: 'no-such-module' })
      .expect(404)

    expect(scan.body).toHaveLength(9)
    expect(refused.body.code).toBe('NOT_FOUND')
    expect(act.mock.calls.map(([name]) => name)).toEqual([
      'bots.deployUserBase',
      'files.write',
      'scan.scan',
      'factory.craft'
    ])
    act.mockRestore()
  })

  it('does a manual action by the rules of a script call, and shows what the bot carries', async () => {
    const { accessToken, botId } = await deployWithScript('export async function main() {}')
    const stranger = await signUpVerified(testApp, database, 'stranger-of-manual@example.com')
    const act = (token: string, body: object) =>
      request(testApp.url).post(`/api/v1/bots/${botId}/actions`).set(bearer(token)).send(body)

    const storage = await request(testApp.url).get(`/api/v1/bots/${botId}/storage`).set(bearer(accessToken)).expect(200)
    expect(storage.body).toMatchObject({
      capacity: 200,
      used: 50,
      resources: [{ resource: 'oil', amount: 50 }],
      items: [],
      carriedWeight: 0
    })
    await request(testApp.url).get(`/api/v1/bots/${botId}/storage`).set(bearer(stranger.accessToken)).expect(403)
    await request(testApp.url).get('/api/v1/bots/nope/storage').set(bearer(accessToken)).expect(400)

    expect((await act(accessToken, { fn: 'view' }).expect(200)).body).toMatchObject({ ok: false, code: 'NOT_LIVE' })
    expect((await act(accessToken, { fn: 'scan' }).expect(200)).body).toMatchObject({ ok: true })
    // A base has no engine, no movement and no manipulator
    await act(accessToken, { fn: 'move', args: [1] }).expect(400)
    await act(accessToken, { fn: 'drop' }).expect(400)
    await act(accessToken, { fn: 'fly' }).expect(400)
    await act(accessToken, { fn: 'drop; rm' }).expect(400)
    await act(stranger.accessToken, { fn: 'scan' }).expect(403)
  })

  it('refuses a manual action of a category that is switched off, in the game or by the player', async () => {
    const { accessToken, botId } = await deployWithScript('export async function main() {}')
    const craft = () =>
      request(testApp.url)
        .post(`/api/v1/bots/${botId}/factory/craft`)
        .set(bearer(accessToken))
        .send({ module: 'no-such-module' })
    const setting = (body: object) => request(testApp.url).patch('/api/v1/settings').set(bearer(accessToken)).send(body)

    // Fabrication is on: the request gets as far as the use case, which does not know the module
    await craft().expect(404)

    await setting({ categories: { fabrication: false } }).expect(200)
    expect((await craft().expect(403)).body.code).toBe('MANUAL_CATEGORY_DISABLED')

    await setting({ categories: { fabrication: true } }).expect(200)
    await craft().expect(404)

    // Observation has no category
    await setting({ categories: { movement: false, combat: false } }).expect(200)
    await request(testApp.url)
      .post(`/api/v1/bots/${botId}/actions`)
      .set(bearer(accessToken))
      .send({ fn: 'scan' })
      .expect(200)
  })

  it('makes a directory and lists it again', async () => {
    const { accessToken, botId } = await deployWithScript('export async function main() {}')
    const drive = await database.client.module.findFirstOrThrow({ where: { botId, type: 'drive' } })
    const base = `/api/v1/bots/${botId}/drives/${drive.id}`

    await request(testApp.url)
      .post(`${base}/directories`)
      .set(bearer(accessToken))
      .send({ path: 'scripts' })
      .expect(201)
    const listed = await request(testApp.url).get(`${base}/files`).set(bearer(accessToken)).expect(200)

    expect(listed.body.map((f: { path: string }) => f.path)).toContain('scripts')
  })
})

describe("the engine to the player's sockets", () => {
  const open = (token: string) =>
    new Promise<Socket>((resolve, reject) => {
      const socket = connect(testApp.url, { auth: { token }, reconnection: false, transports: ['websocket'] })
      socket.on('connect', () => resolve(socket))
      socket.on('connect_error', reject)
    })

  it("pushes the log of a script, its state and the game events to the player's connections only", async () => {
    const { userId, botId, accessToken } = await deployWithScript(
      'export async function main(bot) { bot.log("to you") }'
    )
    const stranger = await deployWithScript('export async function main() {}')
    const mine = await open(accessToken)
    const theirs = await open(stranger.accessToken)
    const heard: Record<string, Array<[string, unknown]>> = { mine: [], theirs: [] }
    mine.onAny((event, payload) => heard.mine.push([event, payload]))
    theirs.onAny((event, payload) => heard.theirs.push([event, payload]))

    await port.start({ userId, botId, file: '/memory-class1/main.js', args: [] })
    await until(() => heard.mine.some(([event]) => event === 'game-event'), 'the game event')

    expect(heard.mine.map(([event]) => event)).toEqual(
      expect.arrayContaining(['execution', 'script-log', 'game-event'])
    )
    expect(heard.mine.find(([event]) => event === 'script-log')?.[1]).toMatchObject({ text: 'to you', botId })
    expect(heard.mine.find(([event]) => event === 'game-event')?.[1]).toMatchObject({ type: 'ExecutionFinished' })
    // What they earn on their own (the first achievement of a player who has just deployed a base) is theirs to hear
    expect(heard.theirs.filter(([event]) => !['achievement-unlocked', 'notification'].includes(event))).toEqual([])
    mine.close()
    theirs.close()
  })
})

describe('achievements from the events of the engine (design §23)', () => {
  it('unlocks what a player earns by deploying a base and running a script, tells their sockets, and keeps the progress', async () => {
    players += 1
    const player = await signUpVerified(testApp, database, `player${players}@example.com`)
    const socket = connect(testApp.url, {
      auth: { token: player.accessToken },
      reconnection: false,
      transports: ['websocket']
    })
    await new Promise<void>((resolve, reject) => {
      socket.on('connect', () => resolve())
      socket.on('connect_error', reject)
    })
    const unlocked: string[] = []
    socket.on('achievement-unlocked', (unlock: { id: string }) => unlocked.push(unlock.id))
    const notified: Array<{ category: string; kind: string }> = []
    socket.on('notification', (notification: { category: string; kind: string }) => notified.push(notification))

    const deployed = await request(testApp.url)
      .post('/api/v1/bots/base')
      .set(bearer(player.accessToken))
      .send({ password: 'secret1' })
      .expect(201)
    await until(() => unlocked.includes('firstSteps'), 'the first achievement')

    const botId = deployed.body.bot._id as string
    const drive = await database.client.module.findFirstOrThrow({ where: { botId, type: 'drive' } })
    await request(testApp.url)
      .put(`/api/v1/bots/${botId}/drives/${drive.id}/file`)
      .set(bearer(player.accessToken))
      .send({ path: 'main.js', content: 'export async function main(bot) { bot.log("hi") }' })
      .expect(200)
    await port.start({ userId: player.userId, botId, file: '/memory-class1/main.js', args: [] })
    await until(() => unlocked.includes('helloWorld'), 'the second achievement')

    await until(() => notified.some((n) => n.kind === 'scriptFinished'), 'the notification of the script')
    expect(notified.map((n) => n.kind)).toEqual(expect.arrayContaining(['achievementUnlocked', 'scriptFinished']))
    const stored = (await request(testApp.url).get('/api/v1/notifications').set(bearer(player.accessToken)).expect(200))
      .body as { items: Array<{ kind: string }>; unread: number }
    expect(stored.items.map((item) => item.kind)).toEqual(expect.arrayContaining(['scriptFinished']))
    expect(stored.unread).toBeGreaterThan(0)

    const list = (await request(testApp.url).get('/api/v1/achievements').set(bearer(player.accessToken)).expect(200))
      .body as Array<{ id: string; unlockedAt: number | null }>
    expect(
      list
        .filter((item) => item.unlockedAt !== null)
        .map((item) => item.id)
        .sort()
    ).toEqual(['firstSteps', 'helloWorld'])
    socket.close()
  })
})

describe('scripts from the terminal', () => {
  const ask = <T>(socket: Socket, event: string, ...args: unknown[]) =>
    new Promise<T>((resolve, reject) =>
      socket.emit(event, ...args, (result: T | null, error?: { msg: string }) =>
        result ? resolve(result) : reject(new Error(error?.msg))
      )
    )
  const lines = (reply: { result: { lines?: string[] } }) => reply.result.lines ?? []

  it('runs a file and a line of the shell, streams their output, keeps it in the log, and kills a loop', async () => {
    const { botId, accessToken } = await deployWithScript(
      'export async function main(bot, n) { bot.log("ran", n); while (n === 0) { await bot.sleep(1) } }'
    )
    const socket = await new Promise<Socket>((resolve, reject) => {
      const opened = connect(testApp.url, {
        auth: { token: accessToken },
        reconnection: false,
        transports: ['websocket']
      })
      opened.on('connect', () => resolve(opened))
      opened.on('connect_error', reject)
    })
    const heard: string[] = []
    socket.on('script-log', (log: { text: string }) => heard.push(log.text))
    const session = await ask<{ _id: string }>(socket, 'open-terminal', botId)
    const command = (line: string) =>
      ask<{ result: { lines?: string[]; message?: string } }>(socket, 'terminal-command', session._id, line)

    expect(lines(await command('run /memory-class1/main.js 7'))[0]).toMatch(/^started /)
    await until(() => heard.includes('ran 7'), 'the output of the file')
    await command('eval bot.modules.length')
    await until(() => heard.length >= 2, 'the value of the line')
    expect(Number(heard[1])).toBeGreaterThan(0)

    const looping = lines(await command('run /memory-class1/main.js 0'))[0].replace('started ', '')
    await until(() => heard.includes('ran 0'), 'the loop to start')
    expect(lines(await command('top')).join('\n')).toContain(looping)
    expect(lines(await command(`kill ${looping.slice(0, 8)}`))).toEqual([`killed ${looping}`])
    expect(lines(await command('top'))).toEqual([])

    // The log is written in batches a moment after the lines were heard
    let history: string[] = []
    await until(async () => {
      const entries = await ask<Array<{ text: string }>>(socket, 'get-terminal-history', botId, 100)
      history = entries.map((entry) => entry.text)
      return history.some((text) => /^\[[0-9a-f]{8}\] ran 7$/.test(text))
    }, 'the lines to be stored')
    expect(history).toEqual(expect.arrayContaining([expect.stringMatching(/^\[[0-9a-f]{8}\] ran 7$/)]))
    socket.close()
  })
})

describe('the engine thread', () => {
  it('runs a script of a player: logs, a scan through the use cases, and a durable record', async () => {
    const { userId, botId } = await deployWithScript(
      'export async function main(bot, who) { bot.log("hello", who); const r = await bot.scan(); bot.log(r.ok, r.data.length) }'
    )

    const view = await port.start({ userId, botId, file: '/memory-class1/main.js', args: ['world'] })
    await until(() => logsOf().includes('true 9'), 'the scan result')

    expect(logsOf()).toEqual(['hello world', 'true 9'])
    expect(view).toMatchObject({ botId, file: '/memory-class1/main.js', state: 'queued' })
    await until(() => events.some((e) => e.type === 'execution' && e.execution.state === 'finished'), 'the end')
    expect(await database.client.execution.findUniqueOrThrow({ where: { id: view.id } })).toMatchObject({
      status: 'finished',
      args: ['world']
    })
    await expect(port.metrics()).resolves.toMatchObject({ executions: 0, overrunTicks: expect.any(Number) })
  })

  it('refuses a stranger, an unreadable file and a bot without a processor', async () => {
    const { userId, botId } = await deployWithScript('export async function main() {}')

    await expect(
      port.start({ userId: '11111111-1111-4111-8111-111111111111', botId, file: '/x', args: [] })
    ).rejects.toMatchObject({
      statusCode: 403
    })
    await expect(port.start({ userId, botId, file: '/memory-class1/missing.js', args: [] })).rejects.toMatchObject({
      statusCode: 404
    })
    await database.client.module.updateMany({ where: { botId, type: 'processor' }, data: { condition: 0 } })
    await expect(port.start({ userId, botId, file: '/memory-class1/main.js', args: [] })).rejects.toMatchObject({
      code: 'NO_MODULE'
    })
  })

  it('lists and kills a running execution', async () => {
    const { userId, botId } = await deployWithScript('export async function main(bot) { await sleep(1000000) }')
    const view = await port.start({ userId, botId, file: '/memory-class1/main.js', args: [] })

    await until(() => events.length > 0, 'the start')
    const listed = await port.list(userId)
    expect(listed.map((e) => e.id)).toEqual([view.id])

    await expect(port.kill(userId, view.id)).resolves.toMatchObject({ state: 'killed', reason: 'killed' })
    expect(await port.list(userId)).toEqual([])
    expect((await database.client.execution.findUniqueOrThrow({ where: { id: view.id } })).status).toBe('killed')
  })

  it('relaunches a running script after the engine thread dies, with a rebooted note', async () => {
    const { userId, botId } = await deployWithScript(
      'export async function main(bot) { bot.log("up"); await sleep(1000000) }'
    )
    const view = await port.start({ userId, botId, file: '/memory-class1/main.js', args: [] })
    await until(() => logsOf().length === 1, 'the first start')

    const worker = (testApp.app.get<EngineProcess>(ENGINE_PROCESS) as unknown as { worker: WorkerLike }).worker
    await worker.terminate()
    await until(() => logsOf().length === 3, 'the relaunch', 40000)

    expect(logsOf()).toEqual(['up', expect.stringMatching(/^rebooted/), 'up'])
    expect(await database.client.execution.findUniqueOrThrow({ where: { id: view.id } })).toMatchObject({
      status: 'active',
      restarts: 1
    })
    await port.kill(userId, view.id)
  }, 90000)

  it('ends an engine thread that a script holds for too long, kills that script, and serves the others afterwards', async () => {
    const hog = await deployWithScript(
      'export async function main() { const big = new Array(20000).fill(7); for (;;) big.slice().sort() }'
    )
    const other = await deployWithScript('export async function main(bot) { bot.log("fine after the stall") }')
    const hogView = await port.start({ userId: hog.userId, botId: hog.botId, file: '/memory-class1/main.js', args: [] })

    await until(() => logsOf().some((line) => line.includes('stalled the engine')), 'the watchdog', 40000)

    expect(await database.client.execution.findUniqueOrThrow({ where: { id: hogView.id } })).toMatchObject({
      status: 'killed',
      reason: 'stalled the engine'
    })
    // The next engine thread does not start the script again, and serves a script of someone else
    const start = async () => {
      for (let attempt = 0; attempt < 60; attempt++) {
        try {
          return await port.start({
            userId: other.userId,
            botId: other.botId,
            file: '/memory-class1/main.js',
            args: []
          })
        } catch {
          await new Promise((resolve) => setTimeout(resolve, 500))
        }
      }
      throw new Error('The engine did not come back')
    }
    await start()
    await until(() => logsOf().includes('fine after the stall'), 'the other script', 40000)
    expect(await port.list(hog.userId)).toEqual([])
  }, 120000)
})

describe('what the admins control (design §25.3)', () => {
  const FILE = '/memory-class1/main.js'

  it('pauses the world and lifts the pause, keeping the state in the database', async () => {
    const { userId, botId } = await deployWithScript('export async function main(bot) { bot.log("controlled") }')

    expect(await port.control({ type: 'pause' })).toMatchObject({ isPaused: true })
    await expect(port.start({ userId, botId, file: FILE, args: [] })).rejects.toMatchObject({
      code: 'MAINTENANCE_MODE'
    })
    expect(
      JSON.stringify((await database.client.gameSetting.findUniqueOrThrow({ where: { key: 'engine.control' } })).value)
    ).toContain('"isPaused":true')

    expect(await port.control({ type: 'resume' })).toMatchObject({ isPaused: false })
    await port.start({ userId, botId, file: FILE, args: [] })
    await until(() => logsOf().includes('controlled'), 'the script after the pause')
  })

  it('refuses a quarantined player and the kill-switch, and reboots a bot', async () => {
    const { userId, botId } = await deployWithScript('export async function main(bot) { for (;;) { await sleep(50) } }')

    await port.control({ type: 'quarantine', userId, isOn: true })
    await expect(port.start({ userId, botId, file: FILE, args: [] })).rejects.toMatchObject({
      code: 'PLAYER_QUARANTINED'
    })
    await port.control({ type: 'quarantine', userId, isOn: false })

    await port.start({ userId, botId, file: FILE, args: [] })
    const restarted = await port.reboot(botId)
    expect(restarted).toHaveLength(1)
    expect(await port.list(userId)).toHaveLength(1)

    expect(await port.control({ type: 'halt-scripts', isOn: true })).toMatchObject({ areScriptsHalted: true })
    expect(await port.list(userId)).toEqual([])
    await expect(port.start({ userId, botId, file: FILE, args: [] })).rejects.toMatchObject({ code: 'SCRIPTS_HALTED' })
    await port.control({ type: 'halt-scripts', isOn: false })
  })

  it('puts resources right as a world action, all or nothing', async () => {
    const { botId } = await deployWithScript('export async function main() {}')

    await port.act('support.grantResources', [botId, [{ resource: RESOURCE.IRON, amount: 10 }]])
    const storage = await database.client.module.findFirstOrThrow({ where: { botId, type: 'storage' } })
    expect(JSON.stringify(storage.props)).toContain('"iron"')

    await expect(
      port.act('support.removeResources', [botId, [{ resource: RESOURCE.GOLD, amount: 999 }]])
    ).rejects.toMatchObject({
      statusCode: 400
    })
    await port.act('support.removeResources', [botId, [{ resource: RESOURCE.IRON, amount: 10 }]])
    await port.act('support.restoreModule', [botId, storage.id])
  })
})
