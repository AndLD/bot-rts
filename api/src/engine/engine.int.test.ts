import request from 'supertest'
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
  testApp = await startTestApp(database, { ENGINE_ENABLED: 'true', ENGINE_TICK_INTERVAL_MS: '20' })
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

async function until(condition: () => boolean, what: string, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs
  while (!condition()) {
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
})
