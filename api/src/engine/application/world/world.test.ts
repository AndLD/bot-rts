import { MapPointType } from '../../../../../lib/utils/interfaces/map'
import { EngineMetrics } from '../engine-metrics'
import { createEngineWorld } from '../../../../tests/fakes/world-engine'
import { BOT_TYPE } from '../../../../../lib/utils/interfaces/bots'
import { buildItem } from '../../../../tests/integration/builders'

describe('World cache metrics', () => {
  it('counts the bots and the cells found in memory, and the ones that had to be loaded', async () => {
    const metrics = new EngineMetrics()
    const { world, addBot, placeCell } = createEngineWorld({ recorder: metrics })
    addBot('b1', { x: 2, y: 2, z: 0 })
    placeCell({ x: 1, y: 1, z: 0 })

    await world.bot('b1')
    await world.bot('b1')
    await world.bot('missing')
    await world.cell({ x: 1, y: 1, z: 0 })
    await world.cell({ x: 1, y: 1, z: 0 })

    // 1 bot found, 2 bots loaded (one missing), 1 cell found, 1 cell loaded
    expect(metrics.snapshot().counters).toEqual({ cacheHits: 2, cacheMisses: 3 })
  })
})

describe('World', () => {
  it('loads a bot once and keeps handing out the same one', async () => {
    const { world, addBot } = createEngineWorld()
    addBot('b1', { x: 2, y: 2, z: 0 })

    const first = await world.bot('b1')
    const second = await world.bot('b1')

    expect(first).toBe(second)
    expect(first?.position).toEqual({ x: 2, y: 2, z: 0 })
    expect(await world.bot('missing')).toBeNull()
    expect(world.loadedBots).toHaveLength(1)
  })

  it('loads the chunk of a cell once and rolls the cells that do not exist yet', async () => {
    const { world, source, placeCell, writeBehind } = createEngineWorld()
    placeCell({ x: 1, y: 1, z: 0 }, { type: MapPointType.RESOURCE })

    expect((await world.cell({ x: 1, y: 1, z: 0 })).type).toBe(MapPointType.RESOURCE)
    const rolled = await world.cell({ x: 2, y: 2, z: 0 })
    await world.cell({ x: 3, y: 3, z: 0 })

    expect(rolled.id).toBe('cell-2:2:0')
    expect(source.loads).toBe(1)
    expect(writeBehind.pending).toBe(3 - 1)
  })

  it('stages the item that a rolled cell holds', async () => {
    const { world, source, writeBehind } = createEngineWorld()
    const item = buildItem({ id: 'found' })
    source.generate = (location) => ({
      point: { id: 'p', location, type: MapPointType.ITEM, contentId: item.id, resource: null },
      item
    })

    await world.cell({ x: 1, y: 1, z: 0 })

    expect(world.item('found')).toEqual(item)
    expect(writeBehind.pending).toBe(2)
  })

  it('moves a bot: the old cell becomes free and the new one is occupied', async () => {
    const { world, addBot, placeCell } = createEngineWorld()
    addBot('b1', { x: 2, y: 2, z: 0 })
    placeCell({ x: 3, y: 2, z: 0 })
    const bot = (await world.bot('b1'))!

    await world.place(bot, { x: 3, y: 2, z: 0 })

    expect(bot.position).toEqual({ x: 3, y: 2, z: 0 })
    expect(await world.cell({ x: 2, y: 2, z: 0 })).toMatchObject({ type: null, contentId: null })
    expect(await world.cell({ x: 3, y: 2, z: 0 })).toMatchObject({ type: MapPointType.BOT, contentId: 'b1' })
  })

  it('shows a base as a base, and places a bot that had no cell', async () => {
    const { world, addBot } = createEngineWorld()
    addBot('base', null, undefined, { type: BOT_TYPE.BASE })
    const base = (await world.bot('base'))!

    await world.place(base, { x: 1, y: 1, z: 0 })

    expect(await world.cell({ x: 1, y: 1, z: 0 })).toMatchObject({ type: MapPointType.BASE, contentId: 'base' })
  })

  it('turns a bot and remembers the heading to write', async () => {
    const { world, addBot, writeBehind } = createEngineWorld()
    addBot('b1', { x: 0, y: 0, z: 0 })
    const bot = (await world.bot('b1'))!

    world.turn(bot, 2)

    expect(bot.heading).toBe(2)
    expect(writeBehind.pending).toBe(1)
  })

  it('moves an item between the ground and a bot, and uses it up', async () => {
    const { world, addBot, writeBehind } = createEngineWorld()
    addBot('b1', { x: 0, y: 0, z: 0 })
    const bot = (await world.bot('b1'))!
    const item = buildItem({ id: 'i1' })

    world.setItemHolder(item, bot)
    expect(bot.carried.map((i) => i.id)).toEqual(['i1'])
    expect(world.item('i1')?.botId).toBe('b1')

    world.setItemHolder(world.item('i1')!, null)
    expect(bot.carried).toEqual([])

    world.setItemHolder(item, bot)
    world.consumeItem(bot, bot.carried[0])
    expect(bot.carried).toEqual([])
    expect(world.item('i1')).toBeUndefined()
    expect(writeBehind.pending).toBe(1)
  })

  it('pays operations from the batteries and reports a lack of energy without charging', async () => {
    const { world, addBot } = createEngineWorld()
    addBot('b1', { x: 0, y: 0, z: 0 })
    const bot = (await world.bot('b1'))!
    const before = world.energyOf(bot)

    expect(world.spend(bot, 5)).toEqual({ ok: true, data: undefined })
    expect(world.energyOf(bot)).toBe(before - 5)
    expect(world.spend(bot, before)).toMatchObject({ ok: false, code: 'NO_ENERGY' })
    expect(world.energyOf(bot)).toBe(before - 5)
  })

  it('drains idle energy of the loaded bots every tick', async () => {
    const { world, addBot } = createEngineWorld()
    addBot('b1', { x: 0, y: 0, z: 0 })
    const bot = (await world.bot('b1'))!
    const before = world.energyOf(bot)

    world.tickEnergy(1000)

    expect(world.energyOf(bot)).toBeLessThan(before)
  })

  it('knows when a bot is busy and when it is free again', () => {
    const { world } = createEngineWorld()

    world.keepBusy('b1', 3)
    expect(world.isBusy('b1')).toBe(true)
    world.beginTick(4)
    expect(world.isBusy('b1')).toBe(false)
    expect(world.tick).toBe(4)
  })

  it('draws the same random numbers for the same seed and tick', () => {
    const a = createEngineWorld({ seed: 9 }).world
    const b = createEngineWorld({ seed: 9 }).world
    a.beginTick(5)
    b.beginTick(5)

    expect([a.random(), a.random()]).toEqual([b.random(), b.random()])
    b.beginTick(6)
    expect(b.random()).not.toBe(a.random())
  })

  it('writes behind on sync and starts afresh after an eviction', async () => {
    const { world, addBot, batches, source } = createEngineWorld()
    addBot('b1', { x: 0, y: 0, z: 0 })
    const bot = (await world.bot('b1'))!
    world.turn(bot, 1)

    await world.sync()
    expect(batches[0].headings).toEqual([{ botId: 'b1', heading: 1 }])

    world.evict()
    source.bots.get('b1')!.heading = 3
    expect((await world.bot('b1'))?.heading).toBe(3)
    expect(world.hardnessOf('gold' as never)).toBe(3)
  })

  it('does not overwrite a change made in memory with the row read afterwards', async () => {
    const { world, placeCell, source } = createEngineWorld()
    placeCell({ x: 1, y: 1, z: 0 }, { type: MapPointType.RESOURCE })
    await world.cell({ x: 1, y: 1, z: 0 })
    const cell = await world.cell({ x: 1, y: 1, z: 0 })
    world.emptyCell(cell)
    source.cells.set('1:1:0', { ...cell, type: MapPointType.RESOURCE })
    world.evict()
    await world.cell({ x: 40, y: 40, z: 0 })

    expect((await world.cell({ x: 1, y: 1, z: 0 })).type).toBe(MapPointType.RESOURCE)
  })

  it('hands out the cells that changed since the last time, newest content first', async () => {
    const { world } = createEngineWorld()
    const cell = await world.cell({ x: 1, y: 1, z: 0 })

    world.setCell({ ...cell, type: MapPointType.RESOURCE })
    world.emptyCell(cell)
    world.setCell({ ...(await world.cell({ x: 2, y: 2, z: 0 })), type: MapPointType.RESOURCE })

    const changed = world.drainChanged()
    expect(changed.map((p) => `${p.location.x},${p.location.y},${p.type}`)).toEqual(['1,1,null', '2,2,resource'])
    expect(world.drainChanged()).toEqual([])
  })

  it('keeps at most the configured number of chunks, dropping the least recently used that are written', async () => {
    const { world, source, writeBehind } = createEngineWorld({ maxChunks: 2 })
    const chunk = (n: number) => ({ x: n * 16, y: 0, z: 0 })
    source.cells.set('0:0:0', {
      id: 'old',
      location: chunk(0),
      type: MapPointType.RESOURCE,
      contentId: null,
      resource: null
    })

    await world.cell(chunk(0))
    world.beginTick(2)
    await world.cell(chunk(1))
    world.beginTick(3)
    await world.cell(chunk(2))
    // Chunks 1 and 2 hold cells that were rolled and are not written yet: only the old, written chunk can go
    world.evictCold()
    expect(world.loadedChunkCount).toBe(2)

    await writeBehind.flush(3)
    world.beginTick(4)
    await world.cell(chunk(1))
    world.evictCold()

    expect(world.loadedChunkCount).toBe(2)
    expect(source.loads).toBe(3)
    await world.cell(chunk(0))
    expect(source.loads).toBe(4)
  })

  it('tells the radio when a bot is loaded, moves, or changes its adapter or whether it has energy', async () => {
    const { world, addBot, placeCell } = createEngineWorld()
    addBot('b1', { x: 2, y: 2, z: 0 }, undefined, { ownerId: 'alice' })
    placeCell({ x: 3, y: 2, z: 0 })
    const heard: string[] = []
    world.onBotChange((owner) => heard.push(owner))

    const bot = (await world.bot('b1'))!
    expect(heard).toEqual(['alice'])
    await world.bot('b1')
    expect(heard).toHaveLength(1)

    await world.place(bot, { x: 3, y: 2, z: 0 })
    expect(heard).toHaveLength(2)

    const adapter = bot.state.modules.find((m) => m.type === 'wirelessAdapter')!
    const battery = bot.state.modules.find((m) => m.type === 'battery')!
    // Draining a battery that still has energy is not news to the radio
    world.updateModules(bot, [{ ...battery, props: { ...battery.props, value: 10 } }])
    expect(heard).toHaveLength(2)
    world.updateModules(bot, [{ ...battery, props: { ...battery.props, value: 0 } }])
    expect(heard).toHaveLength(3)
    world.updateModules(bot, [{ ...adapter, condition: 0 }])
    expect(heard).toHaveLength(4)
  })

  it('starts from the database again when a write is given up on', async () => {
    const { world, writeBehind, source, batches } = createEngineWorld()
    source.cells.set('1:1:0', { id: 'p', location: { x: 1, y: 1, z: 0 }, type: null, contentId: null, resource: null })
    ;(writeBehind as unknown as { store: { flush: jest.Mock } }).store.flush = jest
      .fn()
      .mockRejectedValue(new Error('gone'))
    await world.cell({ x: 1, y: 1, z: 0 })
    world.setCell({ ...(await world.cell({ x: 1, y: 1, z: 0 })), type: MapPointType.RESOURCE })

    for (let i = 0; i < 3; i++) await writeBehind.flush(i).catch(() => undefined)

    expect(world.loadedChunkCount).toBe(0)
    expect(batches).toEqual([])
  })

  it('keeps every chunk when there is room, and tells the listeners when everything is forgotten', async () => {
    const { world } = createEngineWorld({ maxChunks: 8 })
    const forgotten = jest.fn()
    world.onEvict(forgotten)
    await world.cell({ x: 0, y: 0, z: 0 })
    await world.cell({ x: 40, y: 0, z: 0 })

    world.evictCold()
    expect(world.loadedChunkCount).toBe(2)

    world.evict()
    expect(forgotten).toHaveBeenCalledTimes(1)
    expect(world.loadedChunkCount).toBe(0)
  })
})
