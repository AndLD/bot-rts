import { MapPointType } from '../../../../lib/utils/interfaces/map'
import { RESOURCE } from '../../../../lib/utils/interfaces/resources'
import { RecordingSink } from '../../../tests/fakes/engine'
import { SequentialIdGenerator } from '../../../tests/fakes/fakes'
import { createEngineWorld, FULL_KIT } from '../../../tests/fakes/world-engine'
import { KnownPoint } from '../../map/domain/map-point.entity'
import { LiveVision } from './live-vision'

const at = (x: number, y: number) => ({ x, y, z: 0 })
// A scanner-class1 sees one cell around (distance 1) and delays 250 ms, which are 3 ticks at 100 ms
const KIT = [...FULL_KIT, 'scanner-class1']

async function setup() {
  const engine = createEngineWorld()
  const sink = new RecordingSink()
  const vision = new LiveVision(
    engine.world,
    engine.source,
    engine.writeBehind,
    new SequentialIdGenerator(),
    sink,
    100,
    16
  )
  const bot = (id: string, position: ReturnType<typeof at> | null, owner = `owner-${id}`) => {
    engine.addBot(id, position, KIT, { ownerId: owner })
  }
  const scanner = async (botId: string) =>
    (await engine.world.bot(botId))!.state.modules.find((m) => m.type === 'scanner')!
  const switchScanner = async (botId: string, props: Record<string, unknown>, condition?: number) => {
    const worldBot = (await engine.world.bot(botId))!
    const module = await scanner(botId)
    engine.world.updateModules(worldBot, [
      { ...module, props: { ...module.props, ...props }, condition: condition ?? module.condition }
    ])
  }
  const goLive = async (botId: string) => {
    await switchScanner(botId, { isLive: true })
    vision.track(botId)
  }
  let tick = 0
  const advance = async (ticks = 1) => {
    for (let i = 0; i < ticks; i++) {
      tick += 1
      engine.world.beginTick(tick)
      await vision.refresh(tick, tick * 100)
    }
  }
  const visions = () => sink.events.filter((event) => event.type === 'vision')
  const staged = async () => {
    await engine.writeBehind.flush(tick)
    return engine.batches.flatMap((batch) => batch.knownPoints)
  }
  return { ...engine, sink, vision, bot, goLive, switchScanner, scanner, advance, visions, staged }
}

describe('LiveVision', () => {
  it('keeps the cells around a live scanner known and tells the owner in batches', async () => {
    const t = await setup()
    t.bot('b1', at(5, 5))
    await t.goLive('b1')

    await t.advance(1)
    expect(t.vision.areaCount).toBe(1)
    expect(t.visions()).toHaveLength(0)

    await t.advance(3)
    const [batch] = t.visions()
    expect(batch).toMatchObject({ type: 'vision', userId: 'owner-b1', botId: 'b1' })
    expect(batch.type === 'vision' && batch.cells).toHaveLength(9)
    expect(batch.type === 'vision' && batch.cells.find((c) => c.x === 5 && c.y === 5)).toMatchObject({
      type: MapPointType.BOT,
      contentId: 'b1'
    })
    expect(await t.staged()).toHaveLength(9)
  })

  it('hands a change inside the area to the player and ignores changes outside', async () => {
    const t = await setup()
    t.bot('b1', at(5, 5))
    t.placeCell(at(5, 4), { type: MapPointType.RESOURCE, resource: { resource: RESOURCE.IRON, amount: 20 } })
    t.placeCell(at(9, 9), { type: MapPointType.RESOURCE, resource: { resource: RESOURCE.IRON, amount: 20 } })
    await t.goLive('b1')
    await t.advance(4)
    t.sink.events.length = 0

    t.world.setCell({ ...(await t.world.cell(at(5, 4))), resource: { resource: RESOURCE.IRON, amount: 15 } })
    t.world.setCell({ ...(await t.world.cell(at(9, 9))), resource: { resource: RESOURCE.IRON, amount: 1 } })
    await t.advance(3)

    const [batch] = t.visions()
    expect(batch.type === 'vision' && batch.cells).toEqual([
      expect.objectContaining({ x: 5, y: 4, resource: { resource: 'iron', amount: 15 } })
    ])
  })

  it('does not write the seenAt of a cell that stays live unchanged', async () => {
    const t = await setup()
    t.bot('b1', at(5, 5))
    await t.goLive('b1')
    await t.advance(4)
    await t.writeBehind.flush(4)
    const writes = t.batches.length

    await t.advance(10)

    expect(t.writeBehind.pending).toBe(0)
    expect(t.batches).toHaveLength(writes)
  })

  it('looks at the edge only when the bot moves, and lets go of the cells it left behind with their last seenAt', async () => {
    const t = await setup()
    t.bot('b1', at(5, 5))
    await t.goLive('b1')
    await t.advance(4)
    await t.writeBehind.flush(4)
    t.batches.length = 0
    t.sink.events.length = 0

    const worldBot = (await t.world.bot('b1'))!
    await t.world.place(worldBot, at(6, 5))
    await t.advance(3)

    // The three cells that entered the area and the two the bot's own move changed; the cells it left leave without news
    const [batch] = t.visions()
    const cells = batch.type === 'vision' ? batch.cells.map((c) => `${c.x},${c.y}`).sort() : []
    expect(cells).toEqual(['5,5', '6,5', '7,4', '7,5', '7,6'])
    const left = (await t.staged()).filter((p) => p.location.x === 4)
    expect(left).toHaveLength(3)
    expect(left.map((p) => p.seenAt)).toEqual([500, 500, 500])
  })

  it('tells the player where the live areas are once per change, and when the last one is gone', async () => {
    const t = await setup()
    t.bot('a', at(5, 5), 'alice')
    t.bot('b', at(20, 20), 'alice')
    const announced = () => t.sink.events.filter((event) => event.type === 'live-areas')

    await t.goLive('a')
    await t.advance(1)
    await t.advance(1)
    expect(announced()).toEqual([
      {
        type: 'live-areas',
        userId: 'alice',
        areas: [{ scannerId: expect.any(String), botId: 'a', x: 5, y: 5, radius: 1 }]
      }
    ])

    await t.goLive('b')
    await t.advance(1)
    expect(announced()).toHaveLength(2)
    expect(announced()[1]).toMatchObject({ areas: [{ botId: 'a' }, { botId: 'b' }] })

    await t.switchScanner('a', { isLive: false })
    await t.switchScanner('b', { isLive: false })
    await t.advance(1)
    await t.advance(1)
    expect(announced()).toHaveLength(3)
    expect(announced()[2]).toEqual({ type: 'live-areas', userId: 'alice', areas: [] })
  })

  it('keeps a cell live while another scanner of the same player still covers it', async () => {
    const t = await setup()
    t.bot('a', at(5, 5), 'alice')
    t.bot('b', at(6, 5), 'alice')
    await t.goLive('a')
    await t.goLive('b')
    await t.advance(4)
    await t.writeBehind.flush(4)
    t.batches.length = 0

    await t.switchScanner('a', { isLive: false })
    await t.advance(2)

    // The cells only `a` saw are written with their last seenAt, the ones `b` covers too stay live
    const written = (await t.staged()).map((p) => `${p.location.x},${p.location.y}`)
    expect(written).toEqual(expect.arrayContaining(['4,4']))
    expect(written).not.toContain('6,5')
    expect(t.vision.areaCount).toBe(1)
  })

  it('stops when the scanner is switched off or breaks or the bot is gone, and a bot that left the map', async () => {
    const t = await setup()
    t.bot('b1', at(5, 5))
    t.bot('b2', at(20, 20))
    await t.goLive('b1')
    await t.goLive('b2')
    await t.advance(2)
    expect(t.vision.areaCount).toBe(2)

    await t.switchScanner('b1', {}, 0)
    await t.advance(1)
    expect(t.vision.areaCount).toBe(1)

    ;(await t.world.bot('b2'))!.position = null
    await t.advance(1)
    expect(t.vision.areaCount).toBe(0)
  })

  it('answers the live view: everything, or only what changed after a tick', async () => {
    const t = await setup()
    t.bot('b1', at(5, 5))
    t.placeCell(at(5, 4), { type: MapPointType.RESOURCE, resource: { resource: RESOURCE.IRON, amount: 20 } })
    await t.goLive('b1')
    await t.advance(4)
    const scannerId = (await t.scanner('b1')).id

    const everything = await t.vision.view(scannerId)
    expect(everything.tick).toBe(4)
    expect(everything.cells).toHaveLength(9)

    t.world.setCell({ ...(await t.world.cell(at(5, 4))), resource: { resource: RESOURCE.IRON, amount: 5 } })
    await t.advance(1)
    const changed = await t.vision.view(scannerId, 4)
    expect(changed.cells).toEqual([expect.objectContaining({ x: 5, y: 4 })])
    expect(await t.vision.view(scannerId, 5)).toEqual({ tick: 5, cells: [] })
    expect(await t.vision.view('unknown')).toEqual({ tick: 5, cells: [] })
  })

  it('tells who sees a cell', async () => {
    const t = await setup()
    t.bot('a', at(5, 5), 'alice')
    t.bot('b', at(6, 5), 'bob')
    t.bot('c', at(30, 30), 'carol')
    for (const id of ['a', 'b', 'c']) await t.goLive(id)
    await t.advance(1)

    expect(t.vision.audienceAt(at(5, 5))).toEqual(['alice', 'bob'])
    expect(t.vision.audienceAt(at(4, 4))).toEqual(['alice'])
    expect(t.vision.audienceAt(at(9, 9))).toEqual([])
    expect(t.vision.audienceAt(at(30, 31))).toEqual(['carol'])
  })

  it('knows what the player saw before: a cell seen unchanged is not news', async () => {
    const t = await setup()
    t.bot('b1', at(5, 5))
    t.placeCell(at(5, 4), { type: MapPointType.RESOURCE, resource: { resource: RESOURCE.IRON, amount: 20 } })
    const known: KnownPoint = {
      id: 'k1',
      userId: 'owner-b1',
      location: at(5, 4),
      type: MapPointType.RESOURCE,
      contentId: null,
      resource: { resource: RESOURCE.IRON, amount: 20 },
      seenAt: 3
    }
    t.source.known.push(known)
    await t.goLive('b1')

    await t.advance(4)

    const [batch] = t.visions()
    expect(batch.type === 'vision' && batch.cells.some((c) => c.x === 5 && c.y === 4)).toBe(false)
    expect((await t.staged()).filter((p) => p.location.y === 4 && p.location.x === 5)).toEqual([])
  })

  it('starts afresh when the world is evicted, and resumes the bots with a live scanner after a restart', async () => {
    const t = await setup()
    t.bot('b1', at(5, 5))
    await t.switchScanner('b1', {}).catch(() => undefined)
    const stored = t.source.bots.get('b1')!
    const scanner = stored.state.modules.find((m) => m.type === 'scanner')!
    t.source.bots.set('b1', {
      ...stored,
      state: {
        ...stored.state,
        modules: stored.state.modules.map((m) => (m === scanner ? { ...m, props: { ...m.props, isLive: true } } : m))
      }
    })
    t.world.evict()

    await t.vision.restore()
    await t.advance(4)
    expect(t.vision.areaCount).toBe(1)

    t.world.evict()
    await t.advance(1)
    expect((await t.vision.view((await t.scanner('b1')).id)).cells.length).toBeGreaterThan(0)
  })

  it('learns the cells a bot saw while out of reach, keeping the newer sighting of each', async () => {
    const t = await setup()
    t.source.known.push({
      id: 'old',
      userId: 'alice',
      location: at(9, 9),
      type: MapPointType.RESOURCE,
      contentId: null,
      resource: { resource: RESOURCE.IRON, amount: 3 },
      seenAt: 500
    })
    const sighting = (x: number, seenAt: number, id: string): KnownPoint => ({
      id,
      userId: 'alice',
      location: at(x, 9),
      type: null,
      contentId: null,
      resource: null,
      seenAt
    })

    await t.vision.learn('alice', [sighting(9, 400, 'older'), sighting(9, 600, 'newer'), sighting(10, 300, 'fresh')])

    const written = await t.staged()
    expect(written.map((p) => [p.id, p.seenAt])).toEqual([
      ['old', 600],
      ['fresh', 300]
    ])
  })
})
