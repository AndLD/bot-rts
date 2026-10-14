import { randomUUID } from 'crypto'
import request from 'supertest'
import { signUpAdmin } from '../../tests/integration/admin'
import { createTestDatabase, TestDatabase } from '../../tests/integration/test-database'
import { SignedUp, signUpVerified, startTestApp, TestApp } from '../../tests/integration/test-app'
import { ENGINE_PORT } from '../engine/application/engine-port'
import { EngineControl, ControlState } from '../engine/domain/engine-control'
import { PrismaControlStateStore } from '../engine/infrastructure/prisma-control-state.store'

let database: TestDatabase
let testApp: TestApp
let owner: SignedUp
let admin: SignedUp
let moderator: SignedUp
let analyst: SignedUp
let player: SignedUp
const calls: Array<{ method: string; args: unknown[] }> = []

const bearer = (who: SignedUp) => ({ Authorization: `Bearer ${who.accessToken}` })
const api = () => request(testApp.url)
const base = '/api/v1/admin/supervision'

beforeAll(async () => {
  database = await createTestDatabase()
  const store = new PrismaControlStateStore(database.client, { now: () => new Date() })
  // The engine thread is off in tests; this stands in for it and keeps the control state the way the engine does
  const engine = {
    kill: async (...args: unknown[]) => void calls.push({ method: 'kill', args }),
    reboot: async (...args: unknown[]) => {
      calls.push({ method: 'reboot', args })
      return [{}]
    },
    act: async (...args: unknown[]) => void calls.push({ method: 'act', args }),
    control: async (command: EngineControl): Promise<ControlState> => {
      calls.push({ method: 'control', args: [command] })
      const state = await store.load()
      const next: ControlState =
        command.type === 'pause' || command.type === 'resume'
          ? { ...state, isPaused: command.type === 'pause' }
          : command.type === 'halt-scripts'
            ? { ...state, areScriptsHalted: command.isOn }
            : {
                ...state,
                quarantined: command.isOn
                  ? [...state.quarantined, command.userId]
                  : state.quarantined.filter((id) => id !== command.userId)
              }
      await store.save(next)
      return next
    },
    onEvent: () => () => undefined,
    metrics: async () => {
      throw new Error('off')
    },
    list: async () => [],
    start: async () => ({}),
    manual: async () => ({}),
    linkStatus: async () => ({})
  }
  testApp = await startTestApp(database, { RATE_LIMIT_API_MAX: '100000' }, [{ provide: ENGINE_PORT, useValue: engine }])
  owner = await signUpAdmin(testApp, database, 'owner')
  admin = await signUpAdmin(testApp, database, 'admin')
  moderator = await signUpAdmin(testApp, database, 'moderator')
  analyst = await signUpAdmin(testApp, database, 'analyst')
  player = await signUpVerified(testApp, database, 'watched@example.com', 'Watched')
})
afterAll(async () => {
  await testApp.close()
  await database.drop()
})
beforeEach(() => {
  calls.length = 0
})

const auditOf = (action: string, actor: SignedUp) =>
  database.client.adminAuditEntry.findFirstOrThrow({
    where: { action, actorId: actor.userId },
    orderBy: { at: 'desc' }
  })

describe('state', () => {
  it('shows the control state to roles that may see it, not to an analyst', async () => {
    const state = await api().get(`${base}/state`).set(bearer(moderator)).expect(200)

    expect(state.body).toEqual({
      isPaused: false,
      areScriptsHalted: false,
      quarantined: [],
      activeExecutions: 0,
      heldExecutions: 0
    })
    await api().get(`${base}/state`).set(bearer(analyst)).expect(403)
    await api().get(`${base}/state`).set(bearer(player)).expect(403)
  })
})

describe('executions and bots', () => {
  it('kills an active execution through the engine as its owner, and audits it', async () => {
    const botId = randomUUID()
    await database.client.user.update({ where: { id: player.userId }, data: { name: 'Watched' } })
    await database.client.bot.create({
      data: { id: botId, type: 'base', userId: player.userId, passwordHash: 'x', heading: 0 }
    })
    const id = randomUUID()
    await database.client.execution.create({
      data: { id, botId, userId: player.userId, file: '/d/a.js', args: [], status: 'active', createdAt: new Date() }
    })

    await api().post(`${base}/executions/${id}/kill`).set(bearer(admin)).send({ reason: 'runaway script' }).expect(204)

    expect(calls).toEqual([{ method: 'kill', args: [player.userId, id] }])
    expect(await auditOf('supervision.kill-execution', admin)).toMatchObject({
      targetType: 'execution',
      targetId: id,
      reason: 'runaway script',
      outcome: 'success'
    })
    await api()
      .post(`${base}/executions/${randomUUID()}/kill`)
      .set(bearer(admin))
      .send({ reason: 'runaway script' })
      .expect(404)
    await api().post(`${base}/executions/${id}/kill`).set(bearer(admin)).send({}).expect(400)
    await api()
      .post(`${base}/executions/${id}/kill`)
      .set(bearer(analyst))
      .send({ reason: 'runaway script' })
      .expect(403)
  })

  it('reboots a bot', async () => {
    const botId = randomUUID()

    await api().post(`${base}/bots/${botId}/reboot`).set(bearer(moderator)).send({ reason: 'stuck' }).expect(403)
    await api().post(`${base}/bots/${botId}/reboot`).set(bearer(admin)).send({ reason: 'stuck script' }).expect(204)

    expect(calls).toEqual([{ method: 'reboot', args: [botId] }])
    expect((await auditOf('supervision.reboot-bot', admin)).after).toEqual({ restarted: 1 })
  })
})

describe('quarantine', () => {
  it('quarantines and releases a player, shown in the state, and a moderator may not', async () => {
    await api()
      .post(`${base}/players/${player.userId}/quarantine`)
      .set(bearer(moderator))
      .send({ reason: 'abuse' })
      .expect(403)
    await api()
      .post(`${base}/players/${player.userId}/quarantine`)
      .set(bearer(admin))
      .send({ reason: 'suspected botnet' })
      .expect(204)

    const state = await api().get(`${base}/state`).set(bearer(moderator)).expect(200)
    expect(state.body.quarantined).toEqual([{ _id: player.userId, name: 'Watched' }])
    expect(await auditOf('supervision.quarantine', admin)).toMatchObject({
      targetId: player.userId,
      reason: 'suspected botnet'
    })

    await api()
      .post(`${base}/players/${player.userId}/release`)
      .set(bearer(admin))
      .send({ reason: 'cleared after review' })
      .expect(204)
    expect((await api().get(`${base}/state`).set(bearer(moderator))).body.quarantined).toEqual([])
    await api()
      .post(`${base}/players/${owner.userId}/quarantine`)
      .set(bearer(admin))
      .send({ reason: 'not allowed' })
      .expect(403)
    await api()
      .post(`${base}/players/${randomUUID()}/quarantine`)
      .set(bearer(admin))
      .send({ reason: 'unknown one' })
      .expect(404)
  })
})

describe('the world-wide switches', () => {
  it('pauses and resumes the world after the typed word, for admins', async () => {
    const pause = (body: object, who = admin) => api().post(`${base}/world/pause`).set(bearer(who)).send(body)

    await pause({ reason: 'database upgrade' }).expect(400)
    await pause({ reason: 'database upgrade', confirm: 'pause' }).expect(400)
    await pause({ reason: 'database upgrade', confirm: 'PAUSE' }, moderator).expect(403)
    await pause({ reason: 'database upgrade', confirm: 'PAUSE' }).expect(204)

    expect((await api().get(`${base}/state`).set(bearer(admin))).body.isPaused).toBe(true)
    expect(await auditOf('supervision.pause-world', admin)).toMatchObject({
      targetType: 'world',
      reason: 'database upgrade',
      after: { isPaused: true }
    })
    await api().post(`${base}/world/resume`).set(bearer(admin)).send({ reason: 'upgrade done' }).expect(204)
    expect((await api().get(`${base}/state`).set(bearer(admin))).body.isPaused).toBe(false)
  })

  it('switches scripts off and on for owners only, after the typed word', async () => {
    const halt = (body: object, who = owner) => api().post(`${base}/scripts/halt`).set(bearer(who)).send(body)

    await halt({ reason: 'exploit in the sandbox', confirm: 'HALT' }, admin).expect(403)
    await halt({ reason: 'exploit in the sandbox' }).expect(400)
    await halt({ reason: 'exploit in the sandbox', confirm: 'HALT' }).expect(204)
    expect((await api().get(`${base}/state`).set(bearer(owner))).body.areScriptsHalted).toBe(true)

    await api().post(`${base}/scripts/allow`).set(bearer(admin)).send({ reason: 'fixed' }).expect(403)
    await api().post(`${base}/scripts/allow`).set(bearer(owner)).send({ reason: 'sandbox fixed' }).expect(204)
    expect((await api().get(`${base}/state`).set(bearer(owner))).body.areScriptsHalted).toBe(false)
    expect(await auditOf('supervision.halt-scripts', owner)).toMatchObject({ reason: 'exploit in the sandbox' })
  })
})

describe('support actions', () => {
  const botId = randomUUID()
  const moduleId = randomUUID()
  const stacks = [{ resource: 'iron', amount: 25 }]

  it('are sent to the engine as world actions, for owners only, and audited with the reason', async () => {
    const post = (path: string, body: object, who = owner) =>
      api().post(`${base}/support/${path}`).set(bearer(who)).send(body)

    await post('grant-resources', { botId, stacks, reason: 'lost to a bug' }, admin).expect(403)
    await post('grant-resources', { botId, stacks, reason: 'lost to a bug' }).expect(204)
    await post('compensate', { botId, stacks, reason: 'downtime compensation' }).expect(204)
    await post('remove-resources', { botId, stacks, reason: 'duplicated by a bug' }).expect(204)
    await post('restore-module', { botId, moduleId, reason: 'broken by a bug' }).expect(204)

    expect(calls).toEqual([
      { method: 'act', args: ['support.grantResources', [botId, stacks]] },
      { method: 'act', args: ['support.grantResources', [botId, stacks]] },
      { method: 'act', args: ['support.removeResources', [botId, stacks]] },
      { method: 'act', args: ['support.restoreModule', [botId, moduleId]] }
    ])
    expect(await auditOf('supervision.compensate', owner)).toMatchObject({
      reason: 'downtime compensation',
      targetId: botId
    })
    expect(await auditOf('supervision.restore-module', owner)).toMatchObject({
      targetType: 'module',
      targetId: moduleId
    })
  })

  it('validate the amounts, the resources and the ids', async () => {
    const post = (body: object) => api().post(`${base}/support/grant-resources`).set(bearer(owner)).send(body)

    await post({ botId, stacks: [], reason: 'nothing to give' }).expect(400)
    await post({ botId, stacks: [{ resource: 'iron', amount: -1 }], reason: 'negative amount' }).expect(400)
    await post({ botId, stacks: [{ resource: 'iron', amount: 1e9 }], reason: 'far too much' }).expect(400)
    await post({ botId, stacks: [{ resource: 'plutonium', amount: 5 }], reason: 'no such resource' }).expect(400)
    await post({ botId: 'nope', stacks, reason: 'bad bot id' }).expect(400)
    expect(calls).toEqual([])
  })
})
