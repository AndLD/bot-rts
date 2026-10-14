import { BOT_TYPE } from '../../../../lib/utils/interfaces/bots'
import { randomUUID } from 'crypto'
import {
  FakeUnitOfWork,
  InMemoryBotRepository,
  InMemoryFileRepository,
  InMemoryMapRepository,
  InMemoryModuleRepository,
  InMemoryUserRepository
} from '../../../tests/fakes/fakes'
import { FILE_KIND } from '../../../../lib/utils/interfaces/files'
import { buildBase, buildFile, buildModule, buildPoint, buildUser } from '../../../tests/integration/builders'
import { MapPointType } from '../../../../lib/utils/interfaces/map'
import { DEFAULT_WORLD_CONFIG } from '../../map/domain/world-config'
import { MapViewService } from '../../mapview/application/map-view.service'
import { Repositories } from '../../persistence/application/unit-of-work'
import { NotFoundError, ValidationError } from '../../shared/domain/errors'
import { InspectorService } from './inspector.service'
import { InspectorReadModel } from './ports'

function setup() {
  const repositories = {
    users: new InMemoryUserRepository(),
    bots: new InMemoryBotRepository(),
    modules: new InMemoryModuleRepository(),
    files: new InMemoryFileRepository(),
    map: new InMemoryMapRepository()
  }
  const readModel: InspectorReadModel = {
    recentExecutions: async () => [
      {
        id: 'e1',
        botId: 'b',
        userId: 'u',
        file: '/d/a.js',
        args: [],
        status: 'active',
        restarts: 1,
        reason: null,
        createdAt: new Date(1000),
        endedAt: null
      },
      {
        id: 'e2',
        botId: 'b',
        userId: 'u',
        file: '/d/b.js',
        args: [],
        status: 'killed',
        restarts: 0,
        reason: 'killed',
        createdAt: new Date(500),
        endedAt: new Date(900)
      }
    ],
    recentLogs: async () => [{ at: new Date(2000), kind: 'output', text: 'hello' }],
    activeExecutionLocations: async () => [
      { x: 1, y: 1 },
      { x: 2, y: 2 }
    ]
  }
  const mapView = { worldView: jest.fn(async () => ({ now: 1, cells: [], liveAreas: [] })) }
  const service = new InspectorService(
    new FakeUnitOfWork(repositories as unknown as Repositories),
    readModel,
    mapView as unknown as MapViewService,
    DEFAULT_WORLD_CONFIG.resources
  )

  return { repositories, service, mapView }
}

async function seedBase() {
  const ctx = setup()
  const owner = buildUser({ name: 'Alice' })
  await ctx.repositories.users.add(owner)
  const base = buildBase(owner.id, { label: 'Home' })
  await ctx.repositories.bots.add(base)
  const worker = { ...buildBase(owner.id), type: BOT_TYPE.WORKER, userId: null, baseId: base.id, label: null }
  await ctx.repositories.bots.add(worker)
  const drive = buildModule(base.id, { type: 'drive', name: 'main', props: { quota: 1000 } })
  await ctx.repositories.modules.addMany([
    drive,
    buildModule(base.id, { type: 'battery', props: { capacity: 100, value: 40 } }),
    buildModule(base.id, { type: 'battery', props: { capacity: 50, value: 60 } }),
    buildModule(base.id, { type: 'storage', props: { capacity: 100, items: [{ resource: 'iron', amount: 8 }] } }),
    buildModule(base.id, { type: 'weapon' })
  ])
  await ctx.repositories.files.save(buildFile(drive.id, { path: 'run.js', content: 'bot.log(1)', size: 10 }))
  await ctx.repositories.files.save(
    buildFile(drive.id, { path: 'lib', kind: FILE_KIND.DIRECTORY, content: '', size: 0 })
  )
  await ctx.repositories.files.save(buildFile(drive.id, { path: 'lib/util.js', content: 'x', size: 1 }))
  await ctx.repositories.map.addPoints([buildPoint(3, 4, { type: MapPointType.BASE, contentId: base.id })])

  return { ...ctx, owner, base, worker, drive }
}

describe('InspectorService.bot', () => {
  it('shows a base with its owner, place, energy, storage, modules, drives, executions and logs', async () => {
    const { service, base, owner, drive } = await seedBase()

    const view = await service.bot(base.id)

    expect(view).toMatchObject({
      _id: base.id,
      label: 'Home',
      type: 'base',
      ownerId: owner.id,
      ownerName: 'Alice',
      baseId: null,
      position: { x: 3, y: 4 },
      energy: { stored: 90, capacity: 150 },
      storage: [{ resource: 'iron', amount: 8 }],
      drives: [{ _id: drive.id, name: 'main', quota: 1000, usedBytes: 11 }]
    })
    expect(view.modules.map((module) => module.type).sort()).toEqual([
      'battery',
      'battery',
      'drive',
      'storage',
      'weapon'
    ])
    expect(view.executions).toEqual([
      expect.objectContaining({ _id: 'e1', status: 'active', endedAt: null }),
      expect.objectContaining({ _id: 'e2', status: 'killed', endedAt: 900 })
    ])
    expect(view.logs).toEqual([{ at: 2000, kind: 'output', text: 'hello' }])
  })

  it('finds the owner of a worker through its base, and a bot without a place on the map', async () => {
    const { service, worker, owner } = await seedBase()

    const view = await service.bot(worker.id)

    expect(view).toMatchObject({ type: 'worker', ownerId: owner.id, baseId: worker.baseId, position: null })
    expect(view.energy).toEqual({ stored: 0, capacity: 0 })
  })

  it('tells of an owner that is gone and a bot that is not there', async () => {
    const { service, repositories } = setup()
    await repositories.bots.add(buildBase(randomUUID()))
    const [orphan] = [...repositories.bots.items.values()]

    expect((await service.bot(orphan.id)).ownerName).toBeNull()
    await repositories.bots.add({
      ...buildBase(randomUUID()),
      type: BOT_TYPE.WORKER,
      userId: null,
      baseId: randomUUID()
    })
    const worker = [...repositories.bots.items.values()].find((bot) => bot.type === BOT_TYPE.WORKER)
    expect((await service.bot(worker?.id as string)).ownerId).toBeNull()
    await expect(service.bot(randomUUID())).rejects.toThrow(NotFoundError)
  })
})

describe('InspectorService files', () => {
  it('lists the entries of a directory, root first, and reads a file', async () => {
    const { service, base, drive } = await seedBase()

    expect(await service.listFiles(base.id, drive.id, null)).toEqual([
      { path: 'lib', kind: 'directory', size: 0 },
      { path: 'run.js', kind: 'file', size: 10 }
    ])
    expect(await service.listFiles(base.id, drive.id, 'lib')).toEqual([{ path: 'lib/util.js', kind: 'file', size: 1 }])
    expect(await service.readFile(base.id, drive.id, 'run.js')).toEqual({
      path: 'run.js',
      size: 10,
      content: 'bot.log(1)'
    })
  })

  it('refuses a drive of another bot, a missing file and a directory', async () => {
    const { service, base, worker, drive } = await seedBase()

    await expect(service.listFiles(worker.id, drive.id, null)).rejects.toThrow(NotFoundError)
    await expect(service.readFile(base.id, randomUUID(), 'run.js')).rejects.toThrow(NotFoundError)
    await expect(service.readFile(base.id, drive.id, 'nope.js')).rejects.toThrow(NotFoundError)
    await expect(service.readFile(base.id, drive.id, 'lib')).rejects.toThrow(NotFoundError)
  })
})

describe('InspectorService.search', () => {
  it('finds a cell by its coordinates, empty or not', async () => {
    const { service, base } = await seedBase()

    expect(await service.search('3,4')).toEqual([{ kind: 'cell', id: base.id, label: 'base', x: 3, y: 4 }])
    expect(await service.search('(9, 9)')).toEqual([{ kind: 'cell', id: null, label: 'empty', x: 9, y: 9 }])
  })

  it('finds a base, a worker and a player by id', async () => {
    const { service, base, worker, owner } = await seedBase()

    expect(await service.search(base.id)).toEqual([{ kind: 'base', id: base.id, label: 'Home', x: 3, y: 4 }])
    expect(await service.search(worker.id)).toEqual([
      { kind: 'bot', id: worker.id, label: worker.id, x: null, y: null }
    ])
    expect(await service.search(owner.id)).toEqual([{ kind: 'player', id: owner.id, label: 'Alice', x: null, y: null }])
    expect(await service.search(randomUUID())).toEqual([])
  })

  it('says what it understands', async () => {
    const { service } = setup()

    await expect(service.search('hello')).rejects.toThrow(ValidationError)
  })
})

describe('InspectorService maps', () => {
  it('asks the map view for the world without fog', async () => {
    const { service, mapView } = setup()
    const range = { minX: 0, minY: 0, maxX: 10, maxY: 10 }

    await service.worldView(range)

    expect(mapView.worldView).toHaveBeenCalledWith(range)
  })

  it('builds the heatmaps of density, depletion and activity', async () => {
    const { service, repositories } = setup()
    await repositories.map.addPoints([
      buildPoint(1, 1, { type: MapPointType.BASE, contentId: randomUUID() }),
      buildPoint(2, 2, { type: MapPointType.BOT, contentId: randomUUID() }),
      buildPoint(3, 3, { type: null }),
      buildPoint(20, 20, { type: MapPointType.RESOURCE, resource: { resource: 'iron', amount: 0 } as never }),
      buildPoint(21, 21, { type: MapPointType.RESOURCE, resource: null })
    ])
    const range = { minX: 0, minY: 0, maxX: 31, maxY: 31 }

    const density = await service.heatmap({ kind: 'density', range, bucket: 16 })
    expect(density.buckets).toEqual([
      { x: 0, y: 0, value: 2, intensity: 1 },
      { x: 16, y: 16, value: 2, intensity: 1 }
    ])
    const depletion = await service.heatmap({ kind: 'depletion', range, bucket: 16 })
    expect(depletion.buckets).toEqual([{ x: 16, y: 16, value: 1, intensity: 1 }])
    const activity = await service.heatmap({ kind: 'activity', range, bucket: 16 })
    expect(activity.buckets).toEqual([{ x: 0, y: 0, value: 2, intensity: 1 }])
  })

  it('refuses a bucket that is not offered and an area that is too large', async () => {
    const { service } = setup()
    const range = { minX: 0, minY: 0, maxX: 10, maxY: 10 }

    await expect(service.heatmap({ kind: 'density', range, bucket: 5 })).rejects.toThrow(ValidationError)
    await expect(service.heatmap({ kind: 'density', range: { ...range, maxX: 600 }, bucket: 8 })).rejects.toThrow(
      ValidationError
    )
    await expect(
      service.heatmap({ kind: 'density', range: { ...range, maxX: -5, maxY: -5 }, bucket: 8 })
    ).rejects.toThrow(ValidationError)
  })
})
