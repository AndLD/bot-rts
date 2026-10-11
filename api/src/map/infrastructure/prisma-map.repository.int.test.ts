import { randomUUID } from 'crypto'
import { MapPointType } from '../../../../lib/utils/interfaces/map'
import { buildKnownPoint, buildPoint, buildUser } from '../../../tests/integration/builders'
import { createTestDatabase, TestDatabase } from '../../../tests/integration/test-database'
import { PrismaUserRepository } from '../../users/infrastructure/prisma-user.repository'
import { PrismaMapRepository } from './prisma-map.repository'

let database: TestDatabase
let map: PrismaMapRepository
let userId: string

const range = { from: { x: 0, y: 0, z: 0 }, to: { x: 2, y: 2, z: 0 } }

beforeAll(async () => {
  database = await createTestDatabase()
  map = new PrismaMapRepository(database.client)
})
beforeEach(async () => {
  await database.reset()
  const user = buildUser()
  await new PrismaUserRepository(database.client).add(user)
  userId = user.id
})
afterAll(() => database.drop())

describe('PrismaMapRepository: real layer', () => {
  it('stores points and finds those inside a range, ordered by location', async () => {
    const inside = [buildPoint(1, 1), buildPoint(0, 0), buildPoint(2, 0)]
    await map.addPoints([...inside, buildPoint(3, 3), buildPoint(-1, 0)])

    const found = await map.findPointsInRange(range)

    expect(found.map((p) => [p.location.x, p.location.y])).toEqual([
      [0, 0],
      [1, 1],
      [2, 0]
    ])
    expect(found[0]).toEqual(inside[1])
  })

  it('ignores points that already exist at a location when adding', async () => {
    const first = buildPoint(1, 1, { type: MapPointType.RESOURCE })
    await map.addPoints([first])
    await map.addPoints([buildPoint(1, 1)])

    expect(await map.findPointsInRange(range)).toEqual([first])
  })

  it('upserts a point by location and keeps the original id', async () => {
    const original = buildPoint(1, 1)
    await map.addPoints([original])

    const contentId = randomUUID()
    const updated = await map.upsertPoint(buildPoint(1, 1, { type: MapPointType.BASE, contentId }))
    const created = await map.upsertPoint(buildPoint(2, 2))

    expect(updated).toEqual({ ...original, type: MapPointType.BASE, contentId })
    expect(created.location).toEqual({ x: 2, y: 2, z: 0 })
    expect(await map.findPointsInRange(range)).toHaveLength(2)
  })

  it('finds the point of a content id', async () => {
    const contentId = randomUUID()
    const point = buildPoint(1, 1, { type: MapPointType.BOT, contentId })
    await map.addPoints([point, buildPoint(2, 2)])

    expect(await map.findPointByContentId(contentId)).toEqual(point)
    expect(await map.findPointByContentId(randomUUID())).toBeNull()
  })
})

describe('PrismaMapRepository: known points', () => {
  it('upserts snapshots per user and reads them back', async () => {
    const first = buildKnownPoint(userId, 1, 1, { seenAt: 5 })
    await map.upsertKnownPoints([first, buildKnownPoint(userId, 5, 5)])

    expect(await map.findKnownPointsInRange(userId, range)).toEqual([first])

    const refreshed = { ...first, id: randomUUID(), type: MapPointType.ITEM, contentId: randomUUID(), seenAt: 9 }
    await map.upsertKnownPoints([refreshed])

    expect(await map.findKnownPoint(userId, first.location)).toEqual({ ...refreshed, id: first.id })
    expect(await map.findKnownPoint(userId, { x: 9, y: 9, z: 0 })).toBeNull()
  })

  it('keeps the knowledge of users apart', async () => {
    const other = buildUser()
    await new PrismaUserRepository(database.client).add(other)
    await map.upsertKnownPoints([buildKnownPoint(userId, 1, 1), buildKnownPoint(other.id, 1, 1, { seenAt: 3 })])

    expect(await map.findKnownPointsInRange(userId, range)).toHaveLength(1)
    expect((await map.findKnownPoint(other.id, { x: 1, y: 1, z: 0 }))?.seenAt).toBe(3)
  })
})
