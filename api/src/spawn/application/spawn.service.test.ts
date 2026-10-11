import { MapPointType } from '../../../../lib/utils/interfaces/map'
import { createWorld } from '../../../tests/fakes/world'
import { FixedRng } from '../../../tests/fakes/fakes'
import { NoFreeLocationError, SpawnSeedClosedError, SpawnSeedFullError } from '../domain/spawn.errors'
import { ValidationError } from '../../shared/domain/errors'

const PASSWORD = 'secret1'
const user = (n: number) => ({ id: `00000000-0000-4000-8000-00000000000${n}`, name: `Player${n}` })
const HOUR_MS = 3600 * 1000

// Rolls (each draws two numbers: x then y) that land on the given offsets from a centre of half-width `radius`
const roll = (offset: number, radius: number) => (offset + radius) / (2 * radius + 1) + 1e-9
const at = (x: number, y: number, radius = 60) => [roll(x, radius), roll(y, radius)]

describe('SpawnService: the base of a new player', () => {
  it('takes a free cell, at least the minimum distance from every base', async () => {
    // the first draw is 10 cells from the first base (too close), the second is 30 away
    const rng = new FixedRng([...at(-24, 12), ...at(-14, 12), ...at(6, 12)])
    const world = createWorld({ rng })
    const first = await world.botsService.deployUserBase(user(1), { password: PASSWORD })
    expect(first.mapPoint.location).toEqual({ x: -24, y: 12, z: 0 })

    const second = await world.botsService.deployUserBase(user(2), { password: PASSWORD })

    // the ring is now larger (70 for one base): the rolls were made for radius 60, so check the rule rather than the cell
    const distance = Math.max(
      Math.abs(second.mapPoint.location.x - first.mapPoint.location.x),
      Math.abs(second.mapPoint.location.y - first.mapPoint.location.y)
    )
    expect(distance).toBeGreaterThanOrEqual(30)
  })

  it('skips cells that are occupied or are deposits, and fails when no cell fits', async () => {
    const world = createWorld({ rng: new FixedRng([0.5]), spawn: { attempts: 3 } })
    // the only cell the constant rolls ever pick is (0, 0); a deposit is there
    world.repositories.map.points.set('0:0:0', {
      id: 'deposit',
      location: { x: 0, y: 0, z: 0 },
      type: MapPointType.RESOURCE,
      contentId: null,
      resource: null
    })

    await expect(world.botsService.deployUserBase(user(1), { password: PASSWORD })).rejects.toThrow(NoFreeLocationError)
  })

  it('treats an empty known cell as free and an item as taken', async () => {
    const world = createWorld({ rng: new FixedRng([0.5]), spawn: { attempts: 1 } })
    world.repositories.map.points.set('0:0:0', {
      id: 'item',
      location: { x: 0, y: 0, z: 0 },
      type: MapPointType.ITEM,
      contentId: 'item-1',
      resource: null
    })
    await expect(world.botsService.deployUserBase(user(1), { password: PASSWORD })).rejects.toThrow(NoFreeLocationError)

    world.repositories.map.points.set('0:0:0', {
      id: 'empty',
      location: { x: 0, y: 0, z: 0 },
      type: null,
      contentId: null,
      resource: null
    })
    const { mapPoint } = await world.botsService.deployUserBase(user(1), { password: PASSWORD })
    expect(mapPoint.location).toEqual({ x: 0, y: 0, z: 0 })
  })

  it('also keeps its distance from corpse bases', async () => {
    const world = createWorld({ rng: new FixedRng([0.5]), spawn: { attempts: 1 } })
    world.repositories.map.points.set('5:5:0', {
      id: 'corpse',
      location: { x: 5, y: 5, z: 0 },
      type: MapPointType.CORPSE_BASE,
      contentId: 'old-base',
      resource: null
    })

    await expect(world.botsService.deployUserBase(user(1), { password: PASSWORD })).rejects.toThrow(NoFreeLocationError)
  })

  it('widens the area with every base', async () => {
    const world = createWorld({ rng: new FixedRng([0.999999, 0.5]) })
    const first = await world.botsService.deployUserBase(user(1), { password: PASSWORD })
    expect(first.mapPoint.location.x).toBe(60)

    // with one base on the map the same roll reaches 70 (a base placed far away, so that it does not get in the way)
    const other = createWorld({ rng: new FixedRng([0.999999, 0.5]) })
    await other.botsService.deployUserBase(user(1), { password: PASSWORD, location: { x: 1000, y: 1000, z: 0 } })
    const second = await other.botsService.deployUserBase(user(2), { password: PASSWORD })
    expect(second.mapPoint.location.x).toBe(70)
  })
})

describe('SpawnService: spawn seeds', () => {
  // Everyone draws the same cells: the seed area is a square of half-width 12 around the anchor
  async function withAnchor(config = {}) {
    const world = createWorld({ rng: new FixedRng([0.1, 0.9, 0.5, 0.5, 0.1, 0.1, 0.9, 0.9, 0.3, 0.7]), spawn: config })
    const anchor = await world.botsService.deployUserBase(user(1), { password: PASSWORD, seedCode: ' alpha-7k2 ' })
    return { ...world, anchor }
  }

  it('lets the first player set the anchor and the next ones start within the seed radius', async () => {
    const world = await withAnchor()
    const { anchor } = world

    const second = await world.botsService.deployUserBase(user(2), { password: PASSWORD, seedCode: 'ALPHA-7K2' })
    const third = await world.botsService.deployUserBase(user(3), { password: PASSWORD, seedCode: 'Alpha-7k2' })

    for (const joined of [second, third]) {
      const dx = Math.abs(joined.mapPoint.location.x - anchor.mapPoint.location.x)
      const dy = Math.abs(joined.mapPoint.location.y - anchor.mapPoint.location.y)
      expect(Math.max(dx, dy)).toBeLessThanOrEqual(12)
    }
    expect(world.repositories.spawnSeeds.seeds.get('ALPHA-7K2')?.anchor).toEqual(anchor.mapPoint.location)
    expect(world.repositories.spawnSeeds.members.map((m) => m.userId)).toEqual([user(1).id, user(2).id, user(3).id])
  })

  it('refuses a seed that is full, but not a member who starts again', async () => {
    const world = await withAnchor({ seedMaxPlayers: 2 })
    await world.botsService.deployUserBase(user(2), { password: PASSWORD, seedCode: 'ALPHA-7K2' })

    await expect(
      world.botsService.deployUserBase(user(3), { password: PASSWORD, seedCode: 'ALPHA-7K2' })
    ).rejects.toThrow(SpawnSeedFullError)

    // the second player loses the base and starts again with the same code
    const items = world.repositories.modules.items
    const adapter = items.findIndex((m) => m.type === 'wirelessAdapter' && m.botId !== world.anchor.bot.id)
    items[adapter] = { ...items[adapter], condition: 0 }
    const again = await world.botsService.deployUserBase(user(2), { password: PASSWORD, seedCode: 'ALPHA-7K2' })

    expect(world.repositories.spawnSeeds.members.find((m) => m.userId === user(2).id)?.baseId).toBe(again.bot.id)
    expect(world.repositories.spawnSeeds.members).toHaveLength(2)
  })

  it('closes a seed after its time', async () => {
    const world = await withAnchor({ seedTtlHours: 24 })

    world.clock.current = new Date(world.clock.current.getTime() + 24 * HOUR_MS)
    await expect(
      world.botsService.deployUserBase(user(2), { password: PASSWORD, seedCode: 'ALPHA-7K2' })
    ).resolves.toBeDefined()

    world.clock.current = new Date(world.clock.current.getTime() + HOUR_MS)
    await expect(
      world.botsService.deployUserBase(user(3), { password: PASSWORD, seedCode: 'ALPHA-7K2' })
    ).rejects.toThrow(SpawnSeedClosedError)
  })

  it('refuses a malformed code', async () => {
    const world = createWorld()

    await expect(world.botsService.deployUserBase(user(1), { password: PASSWORD, seedCode: 'x' })).rejects.toThrow(
      ValidationError
    )
    expect(world.repositories.bots.items.size).toBe(0)
  })

  it('exempts only the bases of the seed from the minimum distance', async () => {
    const world = await withAnchor({ minBaseDistance: 30, seedRadius: 12 })
    // a stranger's base right next to the anchor: seed members must keep 30 cells from it, which the seed area cannot
    world.repositories.map.points.set('9999:9999:0', {
      id: 'far',
      location: { x: 9999, y: 9999, z: 0 },
      type: MapPointType.BASE,
      contentId: 'stranger',
      resource: null
    })
    const { x, y } = world.anchor.mapPoint.location
    world.repositories.map.points.set(`${x + 2}:${y}:0`, {
      id: 'near',
      location: { x: x + 2, y, z: 0 },
      type: MapPointType.BASE,
      contentId: 'stranger-2',
      resource: null
    })

    await expect(
      world.botsService.deployUserBase(user(2), { password: PASSWORD, seedCode: 'ALPHA-7K2' })
    ).rejects.toThrow(NoFreeLocationError)
  })
})

describe('SpawnService: assembled bots', () => {
  it('places a new bot on a free cell next to the base, which also becomes known to the owner', async () => {
    const world = createWorld({ rng: new FixedRng([0]) })
    const { bot: base } = await world.botsService.deployUserBase(user(1), {
      password: PASSWORD,
      location: { x: 10, y: 10, z: 0 }
    })

    const { bot, mapPoint } = await world.botsService.createBot(user(1).id, {
      baseId: base.id,
      label: 'Digger',
      modules: world.moduleFactory.starterKit('template').slice(1, 2)
    })

    expect(mapPoint).toMatchObject({ type: MapPointType.BOT, contentId: bot.id })
    expect(Math.max(Math.abs(mapPoint.location.x - 10), Math.abs(mapPoint.location.y - 10))).toBe(1)
    expect(world.repositories.map.known.size).toBe(2)
  })

  it('fills the free cells one by one and fails when none is left', async () => {
    const world = createWorld({ rng: new FixedRng([0.3, 0.8, 0.1, 0.6]) })
    const { bot: base } = await world.botsService.deployUserBase(user(1), {
      password: PASSWORD,
      location: { x: 10, y: 10, z: 0 }
    })
    const build = () =>
      world.botsService.createBot(user(1).id, {
        baseId: base.id,
        label: null,
        modules: world.moduleFactory.starterKit('template').slice(1, 2)
      })

    const cells = new Set<string>()
    for (let i = 0; i < 8; i += 1) {
      const { mapPoint } = await build()
      cells.add(`${mapPoint.location.x}:${mapPoint.location.y}`)
    }
    expect(cells.size).toBe(8)

    await expect(build()).rejects.toThrow(NoFreeLocationError)
  })

  it('needs the base to be on the map', async () => {
    const world = createWorld()
    const { bot: base } = await world.botsService.deployUserBase(user(1), { password: PASSWORD })
    world.repositories.map.points.clear()

    await expect(
      world.botsService.createBot(user(1).id, {
        baseId: base.id,
        label: null,
        modules: world.moduleFactory.starterKit('template').slice(1, 2)
      })
    ).rejects.toThrow('The base is not on the map')
  })
})
