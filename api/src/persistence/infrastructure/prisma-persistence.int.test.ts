import { randomUUID } from 'crypto'
import { MapPointType } from '../../../../lib/utils/interfaces/map'
import { RESOURCE } from '../../../../lib/utils/interfaces/resources'
import {
  buildBase,
  buildItem,
  buildKnownPoint,
  buildModule,
  buildPoint,
  buildUser
} from '../../../tests/integration/builders'
import { createTestDatabase, TestDatabase } from '../../../tests/integration/test-database'
import { createPrismaRepositories } from './prisma-repositories'
import { PrismaUnitOfWork } from './prisma-unit-of-work'
import { PrismaWorldStateStore } from './prisma-world-state-store'

let database: TestDatabase

beforeAll(async () => {
  database = await createTestDatabase()
})
beforeEach(() => database.reset())
afterAll(() => database.drop())

describe('PrismaUnitOfWork', () => {
  it('commits the work of all repositories together', async () => {
    const user = buildUser()
    const base = buildBase(user.id)

    await new PrismaUnitOfWork(database.client).run(async ({ users, bots }) => {
      await users.add(user)
      await bots.add(base)
    })

    const { users, bots } = createPrismaRepositories(database.client)
    expect(await users.findById(user.id)).not.toBeNull()
    expect(await bots.findById(base.id)).not.toBeNull()
  })

  it('rolls everything back when the work fails', async () => {
    const user = buildUser()

    await expect(
      new PrismaUnitOfWork(database.client).run(async ({ users }) => {
        await users.add(user)
        throw new Error('boom')
      })
    ).rejects.toThrow('boom')

    expect(await createPrismaRepositories(database.client).users.findById(user.id)).toBeNull()
  })
})

describe('PrismaWorldStateStore', () => {
  it('flushes map points, known points and modules in one batch and upserts on the next one', async () => {
    const user = buildUser()
    const base = buildBase(user.id)
    const repositories = createPrismaRepositories(database.client)
    await repositories.users.add(user)
    await repositories.bots.add(base)
    const store = new PrismaWorldStateStore(database.client)

    const point = buildPoint(1, 1, { type: MapPointType.BASE, contentId: base.id })
    const empty = buildPoint(2, 2)
    const known = buildKnownPoint(user.id, 1, 1, { type: MapPointType.BASE, contentId: base.id, seenAt: 4 })
    const module = buildModule(base.id)
    await store.flush({
      mapPoints: [point, empty],
      knownPoints: [known],
      modules: [module],
      items: [],
      removedItemIds: [],
      headings: []
    })

    const range = { from: { x: 0, y: 0, z: 0 }, to: { x: 5, y: 5, z: 0 } }
    expect(await repositories.map.findPointsInRange(range)).toEqual([point, empty])
    expect(await repositories.map.findKnownPointsInRange(user.id, range)).toEqual([known])
    expect(await repositories.modules.listOfBot(base.id)).toEqual([module])

    const moved = { ...point, id: randomUUID(), type: MapPointType.RESOURCE, contentId: null }
    const damaged = { ...module, condition: 40 }
    await store.flush({
      mapPoints: [moved],
      knownPoints: [{ ...known, id: randomUUID(), seenAt: 9 }],
      modules: [damaged],
      items: [],
      removedItemIds: [],
      headings: []
    })

    expect((await repositories.map.findPointsInRange(range)).map((p) => [p.id, p.type])).toEqual([
      [point.id, MapPointType.RESOURCE],
      [empty.id, null]
    ])
    expect((await repositories.map.findKnownPoint(user.id, known.location))?.seenAt).toBe(9)
    expect(await repositories.modules.listOfBot(base.id)).toEqual([damaged])
  })

  it('flushes the amount of a deposit, the items and the headings of bots', async () => {
    const user = buildUser()
    const base = buildBase(user.id)
    const repositories = createPrismaRepositories(database.client)
    await repositories.users.add(user)
    await repositories.bots.add(base)
    const store = new PrismaWorldStateStore(database.client)
    const deposit = buildPoint(3, 3, {
      type: MapPointType.RESOURCE,
      resource: { resource: RESOURCE.GOLD, amount: 40 }
    })
    const item = buildItem()
    const known = buildKnownPoint(user.id, 3, 3, {
      type: MapPointType.RESOURCE,
      resource: { resource: RESOURCE.GOLD, amount: 40 },
      seenAt: 2
    })
    const base_ = {
      mapPoints: [deposit],
      knownPoints: [known],
      modules: [],
      items: [item],
      removedItemIds: [],
      headings: []
    }

    await store.flush({ ...base_, headings: [{ botId: base.id, heading: 3 }] })

    const range = { from: { x: 0, y: 0, z: 0 }, to: { x: 5, y: 5, z: 0 } }
    expect(await repositories.map.findPointsInRange(range)).toEqual([deposit])
    expect((await repositories.map.findKnownPointsInRange(user.id, range))[0].resource).toEqual(deposit.resource)
    expect(await repositories.items.findById(item.id)).toEqual(item)
    expect((await repositories.bots.findById(base.id))?.heading).toBe(3)

    const mined = { ...deposit, resource: { resource: RESOURCE.GOLD, amount: 25 } }
    const carried = { ...item, botId: base.id }
    await store.flush({ ...base_, mapPoints: [mined], items: [carried] })

    expect((await repositories.map.findPointsInRange(range))[0].resource?.amount).toBe(25)
    expect(await repositories.items.findById(item.id)).toEqual(carried)

    await store.flush({ ...base_, mapPoints: [], knownPoints: [], items: [], removedItemIds: [item.id] })
    expect(await repositories.items.findById(item.id)).toBeNull()
  })

  it('accepts an empty batch', async () => {
    await expect(
      new PrismaWorldStateStore(database.client).flush({
        mapPoints: [],
        knownPoints: [],
        modules: [],
        items: [],
        removedItemIds: [],
        headings: []
      })
    ).resolves.toBeUndefined()
  })

  it('rolls the whole batch back when one part fails', async () => {
    const store = new PrismaWorldStateStore(database.client)
    const point = buildPoint(1, 1)

    await expect(
      store.flush({
        mapPoints: [point],
        knownPoints: [],
        modules: [buildModule(randomUUID())],
        items: [],
        removedItemIds: [],
        headings: []
      })
    ).rejects.toThrow()

    expect(await createPrismaRepositories(database.client).map.findPointByContentId(randomUUID())).toBeNull()
    expect(await database.client.mapPoint.count()).toBe(0)
  })
})
