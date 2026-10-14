import { randomUUID } from 'crypto'
import request from 'supertest'
import { signUpAdmin } from '../../tests/integration/admin'
import { buildBase, buildFile, buildModule, buildPoint } from '../../tests/integration/builders'
import { createTestDatabase, TestDatabase } from '../../tests/integration/test-database'
import { SignedUp, signUpVerified, startTestApp, TestApp } from '../../tests/integration/test-app'
import { FILE_KIND } from '../../../lib/utils/interfaces/files'
import { MapPointType } from '../../../lib/utils/interfaces/map'
import { PrismaBotRepository } from '../bots/infrastructure/prisma-bot.repository'
import { PrismaFileRepository } from '../files/infrastructure/prisma-file.repository'
import { PrismaMapRepository } from '../map/infrastructure/prisma-map.repository'
import { PrismaModuleRepository } from '../modules/infrastructure/prisma-module.repository'

let database: TestDatabase
let testApp: TestApp
let owner: SignedUp
let admin: SignedUp
let moderator: SignedUp
let analyst: SignedUp
let player: SignedUp
let baseId: string
let driveId: string

const bearer = (who: SignedUp) => ({ Authorization: `Bearer ${who.accessToken}` })
const api = () => request(testApp.url)

beforeAll(async () => {
  database = await createTestDatabase()
  testApp = await startTestApp(database, { RATE_LIMIT_API_MAX: '100000' })
  owner = await signUpAdmin(testApp, database, 'owner')
  admin = await signUpAdmin(testApp, database, 'admin')
  moderator = await signUpAdmin(testApp, database, 'moderator')
  analyst = await signUpAdmin(testApp, database, 'analyst')
  player = await signUpVerified(testApp, database, 'inspected@example.com', 'Inspected')

  const base = buildBase(player.userId, { label: 'Home' })
  baseId = base.id
  await new PrismaBotRepository(database.client).add(base)
  const drive = buildModule(base.id, { type: 'drive', name: 'main', props: { quota: 1000 } })
  driveId = drive.id
  await new PrismaModuleRepository(database.client).addMany([
    drive,
    buildModule(base.id, { type: 'battery', props: { capacity: 100, value: 40 } }),
    buildModule(base.id, { type: 'storage', props: { capacity: 100, items: [{ resource: 'iron', amount: 8 }] } })
  ])
  const files = new PrismaFileRepository(database.client)
  await files.save(buildFile(drive.id, { path: 'secret.js', content: 'bot.log("private")', size: 18 }))
  await files.save(buildFile(drive.id, { path: 'lib', kind: FILE_KIND.DIRECTORY, content: '', size: 0 }))
  await files.save(buildFile(drive.id, { path: 'lib/util.js', content: 'x', size: 1 }))
  await new PrismaMapRepository(database.client).addPoints([
    buildPoint(5, 6, { type: MapPointType.BASE, contentId: base.id }),
    buildPoint(9, 9, { type: MapPointType.RESOURCE, resource: { resource: 'iron', amount: 10 } as never })
  ])
  const execution = await database.client.execution.create({
    data: {
      id: randomUUID(),
      botId: base.id,
      userId: player.userId,
      file: `/main/secret.js`,
      args: [],
      status: 'active',
      createdAt: new Date()
    }
  })
  expect(execution.status).toBe('active')
  const session = await database.client.terminalSession.create({
    data: {
      id: randomUUID(),
      userId: player.userId,
      botId: base.id,
      startedAt: new Date()
    }
  })
  await database.client.terminalLog.create({
    data: {
      id: randomUUID(),
      sessionId: session.id,
      botId: base.id,
      at: new Date(),
      kind: 'output',
      text: 'hello admin'
    }
  })
})
afterAll(async () => {
  await testApp.close()
  await database.drop()
})

describe('inspecting a base', () => {
  it('shows everything about it to a moderator, without the contents of files', async () => {
    const view = await api().get(`/api/v1/admin/inspector/bots/${baseId}`).set(bearer(moderator)).expect(200)

    expect(view.body).toMatchObject({
      _id: baseId,
      label: 'Home',
      type: 'base',
      ownerId: player.userId,
      ownerName: 'Inspected',
      position: { x: 5, y: 6 },
      energy: { stored: 40, capacity: 100 },
      storage: [{ resource: 'iron', amount: 8 }]
    })
    expect(view.body.drives).toEqual([{ _id: driveId, name: 'main', quota: 1000, usedBytes: 19 }])
    expect(view.body.executions[0]).toMatchObject({ file: '/main/secret.js', status: 'active' })
    expect(view.body.logs[0]).toMatchObject({ kind: 'output', text: 'hello admin' })
    expect(JSON.stringify(view.body)).not.toContain('private')
  })

  it('answers 404 for a bot that is not there and 400 for a bad id', async () => {
    await api().get(`/api/v1/admin/inspector/bots/${randomUUID()}`).set(bearer(moderator)).expect(404)
    await api().get('/api/v1/admin/inspector/bots/nope').set(bearer(moderator)).expect(400)
  })

  it('is for roles with the permission, not for an analyst or a player', async () => {
    await api().get(`/api/v1/admin/inspector/bots/${baseId}`).set(bearer(analyst)).expect(403)
    await api().get(`/api/v1/admin/inspector/bots/${baseId}`).set(bearer(player)).expect(403)
  })
})

describe('files', () => {
  it('lists a drive for a moderator, but opening a file needs its own permission', async () => {
    const root = await api()
      .get(`/api/v1/admin/inspector/bots/${baseId}/drives/${driveId}/files`)
      .set(bearer(moderator))
      .expect(200)
    expect(root.body.map((file: { path: string }) => file.path)).toEqual(['lib', 'secret.js'])
    const lib = await api()
      .get(`/api/v1/admin/inspector/bots/${baseId}/drives/${driveId}/files?dir=/lib/`)
      .set(bearer(moderator))
      .expect(200)
    expect(lib.body.map((file: { path: string }) => file.path)).toEqual(['lib/util.js'])

    await api()
      .get(`/api/v1/admin/inspector/bots/${baseId}/drives/${driveId}/file?path=secret.js`)
      .set(bearer(moderator))
      .expect(403)
  })

  it('shows the content to an admin and writes an audit entry with the path', async () => {
    const read = await api()
      .get(`/api/v1/admin/inspector/bots/${baseId}/drives/${driveId}/file?path=secret.js`)
      .set(bearer(admin))
      .expect(200)

    expect(read.body).toEqual({ path: 'secret.js', size: 18, content: 'bot.log("private")' })
    const entry = await database.client.adminAuditEntry.findFirstOrThrow({
      where: { actorId: admin.userId, action: 'inspector.read-file' }
    })
    expect(entry).toMatchObject({
      targetType: 'file',
      targetId: `${baseId}/${driveId}/secret.js`,
      outcome: 'success'
    })
    expect(JSON.stringify(entry)).not.toContain('private')
  })

  it('audits a failed read too, and refuses a missing file, another drive and a missing path', async () => {
    await api()
      .get(`/api/v1/admin/inspector/bots/${baseId}/drives/${driveId}/file?path=missing.js`)
      .set(bearer(owner))
      .expect(404)
    expect(
      await database.client.adminAuditEntry.count({
        where: { actorId: owner.userId, action: 'inspector.read-file', outcome: 'failed' }
      })
    ).toBe(1)
    await api()
      .get(`/api/v1/admin/inspector/bots/${baseId}/drives/${randomUUID()}/files`)
      .set(bearer(moderator))
      .expect(404)
    await api().get(`/api/v1/admin/inspector/bots/${baseId}/drives/${driveId}/file`).set(bearer(owner)).expect(400)
  })
})

describe('search', () => {
  it('finds by id and by coordinates', async () => {
    const byBase = await api().get(`/api/v1/admin/inspector/search?q=${baseId}`).set(bearer(moderator)).expect(200)
    expect(byBase.body).toEqual([{ kind: 'base', id: baseId, label: 'Home', x: 5, y: 6 }])

    const byPlayer = await api()
      .get(`/api/v1/admin/inspector/search?q=${player.userId}`)
      .set(bearer(moderator))
      .expect(200)
    expect(byPlayer.body).toEqual([{ kind: 'player', id: player.userId, label: 'Inspected', x: null, y: null }])

    const byCell = await api().get('/api/v1/admin/inspector/search?q=5,6').set(bearer(moderator)).expect(200)
    expect(byCell.body).toEqual([{ kind: 'cell', id: baseId, label: 'base', x: 5, y: 6 }])
    await api().get('/api/v1/admin/inspector/search?q=hello').set(bearer(moderator)).expect(400)
    await api().get('/api/v1/admin/inspector/search').set(bearer(moderator)).expect(400)
  })
})

describe('the world map', () => {
  it('shows every body as it is, without fog of war, to an analyst-excluded role', async () => {
    const view = await api()
      .get('/api/v1/admin/inspector/map?minX=0&minY=0&maxX=20&maxY=20')
      .set(bearer(moderator))
      .expect(200)

    const base = view.body.cells.find((cell: { contentId: string }) => cell.contentId === baseId)
    expect(base).toMatchObject({ x: 5, y: 6, type: 'base', isOwn: true })
    expect(view.body.cells.find((cell: { x: number; y: number }) => cell.x === 9 && cell.y === 9)).toMatchObject({
      type: 'resource',
      resource: { resource: 'iron', amount: 10 }
    })
    await api().get('/api/v1/admin/inspector/map?minX=0&minY=0&maxX=500&maxY=20').set(bearer(moderator)).expect(400)
    await api().get('/api/v1/admin/inspector/map?minX=0&minY=0&maxX=20&maxY=20').set(bearer(analyst)).expect(403)
  })

  it('builds the heatmaps', async () => {
    const heat = (query: string) =>
      api().get(`/api/v1/admin/inspector/heatmap?minX=0&minY=0&maxX=31&maxY=31&${query}`).set(bearer(moderator))

    const density = await heat('kind=density&bucket=8').expect(200)
    expect(density.body.buckets).toEqual([
      { x: 0, y: 0, value: 1, intensity: 1 },
      { x: 8, y: 8, value: 1, intensity: 1 }
    ])
    const depletion = await heat('kind=depletion&bucket=16').expect(200)
    expect(depletion.body.buckets).toHaveLength(1)
    const activity = await heat('kind=activity&bucket=8').expect(200)
    expect(activity.body.buckets).toEqual([{ x: 0, y: 0, value: 1, intensity: 1 }])
    await heat('kind=weather&bucket=8').expect(400)
    await heat('kind=density&bucket=7').expect(400)
  })
})
