import { randomUUID } from 'crypto'
import { BOT_TYPE } from '../../../../lib/utils/interfaces/bots'
import { buildBase, buildUser } from '../../../tests/integration/builders'
import { createTestDatabase, TestDatabase } from '../../../tests/integration/test-database'
import { PrismaUserRepository } from '../../users/infrastructure/prisma-user.repository'
import { Bot } from '../domain/bot.entity'
import { PrismaBotRepository } from './prisma-bot.repository'

let database: TestDatabase
let bots: PrismaBotRepository
let users: PrismaUserRepository

beforeAll(async () => {
  database = await createTestDatabase()
  bots = new PrismaBotRepository(database.client)
  users = new PrismaUserRepository(database.client)
})
beforeEach(() => database.reset())
afterAll(() => database.drop())

const worker = (baseId: string): Bot => ({
  id: randomUUID(),
  label: 'worker',
  type: BOT_TYPE.WORKER,
  userId: null,
  baseId,
  passwordHash: null,
  lastPosition: null,
  heading: 0
})

describe('PrismaBotRepository', () => {
  it('changes the password hash of a bot and moves a bot to another base', async () => {
    const user = buildUser()
    const other = buildUser()
    await users.add(user)
    await users.add(other)
    const base = buildBase(user.id)
    const otherBase = buildBase(other.id)
    await bots.add(base)
    await bots.add(otherBase)
    const ordinary = worker(base.id)
    await bots.add(ordinary)

    await bots.setPasswordHash(ordinary.id, 'new-hash')
    await bots.setBase(ordinary.id, otherBase.id)

    expect(await bots.findById(ordinary.id)).toMatchObject({ passwordHash: 'new-hash', baseId: otherBase.id })
  })

  it('stores and finds a base', async () => {
    const user = buildUser()
    await users.add(user)
    const base = buildBase(user.id)

    await bots.add(base)

    expect(await bots.findById(base.id)).toEqual(base)
    expect(await bots.findById(randomUUID())).toBeNull()
  })

  it('refuses a base without a user and a bot owned by both a user and a base', async () => {
    const user = buildUser()
    await users.add(user)
    const base = buildBase(user.id)
    await bots.add(base)

    await expect(bots.add({ ...base, id: randomUUID(), userId: null })).rejects.toThrow()
    await expect(bots.add({ ...base, id: randomUUID(), baseId: base.id })).rejects.toThrow()
  })

  it('lists the bases of a user and filters by type', async () => {
    const [alice, bob] = [buildUser(), buildUser()]
    await users.add(alice)
    await users.add(bob)
    const aliceBase = buildBase(alice.id)
    await bots.add(aliceBase)
    await bots.add(buildBase(bob.id))

    expect(await bots.listOfUser(alice.id)).toEqual([aliceBase])
    expect(await bots.listOfUser(alice.id, { type: BOT_TYPE.BASE })).toEqual([aliceBase])
    expect(await bots.listOfUser(randomUUID())).toEqual([])
  })

  it('lists the bots of a base for its user', async () => {
    const user = buildUser()
    await users.add(user)
    const base = buildBase(user.id)
    await bots.add(base)
    const child = worker(base.id)
    await bots.add(child)

    expect(new Set((await bots.listOfUser(user.id)).map((bot) => bot.id))).toEqual(new Set([base.id, child.id]))
    expect(await bots.listOfUser(user.id, { type: BOT_TYPE.BASE })).toEqual([base])
    expect(await bots.listOfBase(base.id)).toEqual([child])
  })

  it('deletes the bots with their user', async () => {
    const user = buildUser()
    await users.add(user)
    const base = buildBase(user.id)
    await bots.add(base)

    await database.client.user.delete({ where: { id: user.id } })

    expect(await bots.findById(base.id)).toBeNull()
  })

  it('remembers where a bot without modules was', async () => {
    const user = buildUser()
    await users.add(user)
    const base = buildBase(user.id)
    await bots.add(base)
    const bot = worker(base.id)
    await bots.add(bot)

    await bots.setLastPosition(bot.id, { x: 4, y: -2 })

    expect(await bots.findById(bot.id)).toEqual({ ...bot, lastPosition: { x: 4, y: -2, z: 0 } })
    expect(await bots.findById(base.id)).toMatchObject({ lastPosition: null, heading: 0 })
  })

  it('stores a bot with a last position, and refuses a partial one', async () => {
    const user = buildUser()
    await users.add(user)
    const base = buildBase(user.id)
    await bots.add(base)
    const stored = { ...worker(base.id), lastPosition: { x: 1, y: 2, z: 3 } }

    await bots.add(stored)

    expect(await bots.findById(stored.id)).toEqual(stored)
    await expect(
      database.client.bot.create({ data: { id: randomUUID(), type: 'worker', baseId: base.id, lastX: 1 } })
    ).rejects.toThrow()
  })
})
