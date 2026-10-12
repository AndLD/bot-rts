import { ItemType } from '../../../../../lib/utils/interfaces/items'
import { MapPointType } from '../../../../../lib/utils/interfaces/map'
import { RESOURCE } from '../../../../../lib/utils/interfaces/resources'
import { createEngineWorld, FULL_KIT } from '../../../../tests/fakes/world-engine'
import { buildItem } from '../../../../tests/integration/builders'
import { FakeClock } from '../../../../tests/fakes/fakes'
import { DEFAULT_MOVEMENT_BALANCE, movementOf } from '../../../bots/domain/movement'
import { StorageModule } from '../../../modules/domain/game-module'
import { DEFAULT_COMBAT_BALANCE } from '../../../modules/domain/weapon-module'
import { Module } from '../../../modules/domain/module.entity'
import { BotState } from '../../domain/bot-state'
import { ScriptMisuseError } from '../../domain/script-misuse'
import { CombatHandler, lineBetween } from './combat-handler'
import { GpsHandler } from './gps-handler'
import { ManipulatorHandler } from './manipulator-handler'
import { MiningHandler } from './mining-handler'
import { MovementHandler } from './movement-handler'
import { LiveVision } from '../live-vision'
import { RecordingSink } from '../../../../tests/fakes/engine'
import { SequentialIdGenerator } from '../../../../tests/fakes/fakes'
import { PowerHandler } from './power-handler'
import { ViewHandler } from './view-handler'
import { SyncedHandler } from './synced-handler'
import { ok } from '../../../../../lib/utils/result'

const at = (x: number, y: number) => ({ x, y, z: 0 })

async function setup() {
  const engine = createEngineWorld()
  const clock = new FakeClock()
  const vision = new LiveVision(
    engine.world,
    engine.source,
    engine.writeBehind,
    new SequentialIdGenerator(),
    new RecordingSink(),
    100,
    16
  )
  const handlers = {
    movement: new MovementHandler(engine.world, DEFAULT_MOVEMENT_BALANCE),
    mining: new MiningHandler(engine.world),
    manipulator: new ManipulatorHandler(engine.world),
    combat: new CombatHandler(engine.world, clock, DEFAULT_COMBAT_BALANCE),
    power: new PowerHandler(engine.world, clock, vision),
    view: new ViewHandler(engine.world, vision),
    gps: new GpsHandler(engine.world)
  }
  // The bot as the engine hands it to a handler
  const stateOf = async (id: string): Promise<BotState> => (await engine.world.bot(id))!.state
  const worldBot = async (id: string) => (await engine.world.bot(id))!
  const modulesOf = async (id: string) => (await worldBot(id)).state.modules
  const typeOf = async (id: string, type: string) => (await modulesOf(id)).find((m) => m.type === type)!
  const replace = async (id: string, module: Module) => {
    const bot = await worldBot(id)
    engine.world.updateModules(bot, [module])
  }
  return { ...engine, ...handlers, vision, clock, stateOf, worldBot, modulesOf, typeOf, replace }
}

describe('MovementHandler', () => {
  it('moves a bot forward cell by cell, pays for each cell and keeps it busy while it rolls', async () => {
    const t = await setup()
    t.addBot('b1', at(5, 5))
    const state = await t.stateOf('b1')
    const energy = t.energy.stored(state.modules)

    const result = await t.movement.handle(state, 'move', [2])
    const after = (await t.worldBot('b1')).state.modules

    const ticksPerCell = (movementOf(t.registry.instantiateAll(state.modules)) as { data: { ticksPerCell: number } })
      .data.ticksPerCell
    expect(result).toEqual({ ok: true, data: { moved: 2 }, delayTicks: 2 * ticksPerCell })
    expect((await t.worldBot('b1')).position).toEqual(at(5, 3))
    expect(t.energy.stored(after)).toBe(energy - 4)
    expect((await t.world.cell(at(5, 5))).type).toBeNull()
    expect(await t.world.cell(at(5, 3))).toMatchObject({ type: MapPointType.BOT, contentId: 'b1' })
    expect(await t.movement.handle(state, 'move', [1])).toMatchObject({ ok: false, code: 'BUSY' })
  })

  it('stops at an obstacle after the cells it managed', async () => {
    const t = await setup()
    t.addBot('b1', at(5, 5))
    t.placeCell(at(5, 3), { type: MapPointType.RESOURCE, resource: { resource: RESOURCE.IRON, amount: 5 } })

    const result = await t.movement.handle(await t.stateOf('b1'), 'move', [3])

    expect(result).toMatchObject({ ok: false, code: 'BLOCKED', msg: 'Blocked after 1 of 3 cells' })
    expect((await t.worldBot('b1')).position).toEqual(at(5, 4))
  })

  it('is blocked at once by a cell that is occupied', async () => {
    const t = await setup()
    t.addBot('b1', at(5, 5))
    t.addBot('b2', at(5, 4))

    const result = await t.movement.handle(await t.stateOf('b1'), 'move', [1])

    expect(result).toMatchObject({ ok: false, code: 'BLOCKED', delayTicks: 0 })
    expect((await t.worldBot('b1')).position).toEqual(at(5, 5))
  })

  it('lets only the first of two bots into the same cell', async () => {
    const t = await setup()
    t.addBot('b1', at(4, 5), FULL_KIT, { heading: 1 })
    t.addBot('b2', at(6, 5), FULL_KIT, { heading: 3 })

    const first = await t.movement.handle(await t.stateOf('b1'), 'move', [1])
    const second = await t.movement.handle(await t.stateOf('b2'), 'move', [1])

    expect(first).toMatchObject({ ok: true })
    expect(second).toMatchObject({ ok: false, code: 'BLOCKED' })
  })

  it('stops when the battery runs dry', async () => {
    const t = await setup()
    t.addBot('b1', at(5, 5))
    const battery = await t.typeOf('b1', 'battery')
    await t.replace('b1', { ...battery, props: { ...battery.props, value: 3 } })

    const result = await t.movement.handle(await t.stateOf('b1'), 'move', [5])

    expect(result).toMatchObject({ ok: false, code: 'NO_ENERGY' })
    expect((await t.worldBot('b1')).position).toEqual(at(5, 4))
  })

  it('turns the bot a quarter and moves the way it faces', async () => {
    const t = await setup()
    t.addBot('b1', at(5, 5))
    const state = await t.stateOf('b1')

    expect(await t.movement.handle(state, 'turn', ['right'])).toEqual({ ok: true, data: { heading: 1 } })
    await t.movement.handle(state, 'move', [1])

    expect((await t.worldBot('b1')).position).toEqual(at(6, 5))
    t.world.beginTick(100)
    expect(await t.movement.handle(state, 'turn', ['left'])).toEqual({ ok: true, data: { heading: 0 } })
  })

  it('cannot turn without energy', async () => {
    const t = await setup()
    t.addBot('b1', at(5, 5))
    const battery = await t.typeOf('b1', 'battery')
    await t.replace('b1', { ...battery, props: { ...battery.props, value: 0 } })

    expect(await t.movement.handle(await t.stateOf('b1'), 'turn', ['left'])).toMatchObject({ code: 'NO_ENERGY' })
  })

  it('refuses a bot that cannot move, is not on the map, or asks for nonsense', async () => {
    const t = await setup()
    t.addBot('rooted', at(1, 1), ['processor-class1', 'battery-class1'])
    t.addBot('lost', null)
    t.addBot('b1', at(5, 5))

    expect(await t.movement.handle(await t.stateOf('rooted'), 'move', [1])).toMatchObject({ code: 'NO_MODULE' })
    expect(await t.movement.handle(await t.stateOf('lost'), 'move', [1])).toMatchObject({ code: 'NOT_FOUND' })
    await expect(t.movement.handle(await t.stateOf('b1'), 'move', [0])).rejects.toThrow(ScriptMisuseError)
    await expect(t.movement.handle(await t.stateOf('b1'), 'move', [1000])).rejects.toThrow(/between 1 and/)
  })
})

describe('MiningHandler', () => {
  const deposit = (resource: RESOURCE, amount: number) => ({
    type: MapPointType.RESOURCE,
    resource: { resource, amount }
  })

  it('digs the deposit ahead into the storage and shrinks it', async () => {
    const t = await setup()
    t.addBot('b1', at(5, 5))
    t.placeCell(at(5, 4), deposit(RESOURCE.IRON, 12))
    const state = await t.stateOf('b1')

    expect(await t.mining.handle(state, 'dig', [])).toEqual({ ok: true, data: { resource: 'iron', amount: 5 } })
    expect((await t.world.cell(at(5, 4))).resource?.amount).toBe(7)
    expect(new StorageModule(await t.typeOf('b1', 'storage')).amountOf(RESOURCE.IRON)).toBe(5)
  })

  it('empties the cell when the deposit is used up, and then there is nothing to mine', async () => {
    const t = await setup()
    t.addBot('b1', at(5, 5))
    t.placeCell(at(5, 4), deposit(RESOURCE.STONE, 3))
    const state = await t.stateOf('b1')

    expect(await t.mining.handle(state, 'dig', [])).toMatchObject({ data: { amount: 3 } })
    expect(await t.world.cell(at(5, 4))).toMatchObject({ type: null, resource: null })
    expect(await t.mining.handle(state, 'dig', [])).toMatchObject({ ok: false, code: 'EMPTY' })
  })

  it('shares one deposit between two bots: the second gets what is left, then EMPTY', async () => {
    const t = await setup()
    t.addBot('b1', at(5, 5))
    t.addBot('b2', at(5, 3), FULL_KIT, { heading: 2 })
    t.placeCell(at(5, 4), deposit(RESOURCE.WOOD, 7))

    const first = await t.mining.handle(await t.stateOf('b1'), 'dig', [])
    const second = await t.mining.handle(await t.stateOf('b2'), 'dig', [])
    const third = await t.mining.handle(await t.stateOf('b1'), 'dig', [])

    expect(first).toMatchObject({ data: { amount: 5 } })
    expect(second).toMatchObject({ data: { amount: 2 } })
    expect(third).toMatchObject({ code: 'EMPTY' })
  })

  it('mines a neighbouring cell by its coordinates and refuses a far one', async () => {
    const t = await setup()
    t.addBot('b1', at(5, 5))
    t.placeCell(at(6, 6), deposit(RESOURCE.IRON, 50))
    t.placeCell(at(9, 9), deposit(RESOURCE.IRON, 50))
    const state = await t.stateOf('b1')

    expect(await t.mining.handle(state, 'mine', [6, 6])).toMatchObject({ ok: true })
    expect(await t.mining.handle(state, 'mine', [9, 9])).toMatchObject({ ok: false, code: 'OUT_OF_RANGE' })
  })

  it('cannot break a resource that is too hard, or store more than fits, or mine without energy', async () => {
    const t = await setup()
    t.addBot('b1', at(5, 5))
    t.placeCell(at(5, 4), deposit(RESOURCE.GOLD, 10))
    t.placeCell(at(4, 4), deposit(RESOURCE.IRON, 10))
    const state = await t.stateOf('b1')

    expect(await t.mining.handle(state, 'dig', [])).toMatchObject({ ok: false, code: 'TOO_LOW' })

    const storage = await t.typeOf('b1', 'storage')
    await t.replace('b1', { ...storage, props: { ...storage.props, capacity: 3, items: [] } })
    expect(await t.mining.handle(state, 'mine', [4, 4])).toMatchObject({ ok: false, code: 'NO_SPACE' })

    await t.replace('b1', { ...storage, props: { ...storage.props, capacity: 100, items: [] } })
    const battery = await t.typeOf('b1', 'battery')
    await t.replace('b1', { ...battery, props: { ...battery.props, value: 0 } })
    expect(await t.mining.handle(state, 'mine', [4, 4])).toMatchObject({ ok: false, code: 'NO_ENERGY' })
    expect((await t.world.cell(at(4, 4))).resource?.amount).toBe(10)
  })

  it('does nothing with a broken drill, off the map, or while moving', async () => {
    const t = await setup()
    t.addBot('b1', at(5, 5))
    t.addBot('lost', null)
    t.placeCell(at(5, 4), deposit(RESOURCE.IRON, 10))
    const drill = await t.typeOf('b1', 'mining')
    await t.replace('b1', { ...drill, condition: 0 })

    expect(await t.mining.handle(await t.stateOf('b1'), 'dig', [])).toMatchObject({ code: 'BROKEN_MODULE' })
    expect(await t.mining.handle(await t.stateOf('lost'), 'dig', [])).toMatchObject({ code: 'NOT_FOUND' })
    t.world.keepBusy('b1', 5)
    expect(await t.mining.handle(await t.stateOf('b1'), 'dig', [])).toMatchObject({ code: 'BUSY' })
  })
})

describe('ManipulatorHandler', () => {
  const itemCell = (id: string) => ({ type: MapPointType.ITEM, contentId: id })

  async function withItem(weight = 1) {
    const t = await setup()
    t.addBot('b1', at(5, 5))
    const item = buildItem({ id: 'item-1', type: ItemType.PART, name: 'scanner-class1', weight })
    t.source.items.set(item.id, item)
    t.placeCell(at(5, 4), itemCell(item.id))
    return { t, item }
  }

  it('picks the item ahead up and carries it', async () => {
    const { t } = await withItem()

    const result = await t.manipulator.handle(await t.stateOf('b1'), 'pick', [])

    expect(result).toEqual({ ok: true, data: { id: 'item-1', type: 'part', name: 'scanner-class1', weight: 1 } })
    expect((await t.worldBot('b1')).carried.map((i) => i.id)).toEqual(['item-1'])
    expect((await t.world.cell(at(5, 4))).type).toBeNull()
  })

  it('gives the item to the first bot only: the other finds it GONE', async () => {
    const { t } = await withItem()
    t.addBot('b2', at(5, 3), FULL_KIT, { heading: 2 })

    const first = await t.manipulator.handle(await t.stateOf('b1'), 'take', ['item-1'])
    const second = await t.manipulator.handle(await t.stateOf('b2'), 'take', ['item-1'])

    expect(first).toMatchObject({ ok: true })
    expect(second).toMatchObject({ ok: false, code: 'GONE' })
  })

  it('refuses another item than the one asked for, an empty cell, and a load that is too heavy', async () => {
    const { t } = await withItem(80)
    const state = await t.stateOf('b1')

    expect(await t.manipulator.handle(state, 'take', ['other'])).toMatchObject({ ok: false, code: 'GONE' })
    expect(await t.manipulator.handle(state, 'pick', [])).toMatchObject({ ok: false, code: 'TOO_HEAVY' })
    t.placeCell(at(5, 4), {})
    t.world.evict()
    expect(await t.manipulator.handle(await t.stateOf('b1'), 'pick', [])).toMatchObject({ ok: false, code: 'EMPTY' })
  })

  it('does nothing for a bot that is not on the map', async () => {
    const { t } = await withItem()
    t.addBot('lost', null)

    expect(await t.manipulator.handle(await t.stateOf('lost'), 'pick', [])).toMatchObject({ code: 'NOT_FOUND' })
  })

  it('counts what the bot already carries against its capacity', async () => {
    const { t } = await withItem(30)
    const state = await t.stateOf('b1')
    t.world.setItemHolder(buildItem({ id: 'heavy', weight: 30 }), await t.worldBot('b1'))

    expect(await t.manipulator.handle(state, 'pick', [])).toMatchObject({ ok: false, code: 'TOO_HEAVY' })
  })

  it('cannot lift without energy', async () => {
    const { t } = await withItem()
    const battery = await t.typeOf('b1', 'battery')
    await t.replace('b1', { ...battery, props: { ...battery.props, value: 0 } })

    expect(await t.manipulator.handle(await t.stateOf('b1'), 'pick', [])).toMatchObject({ code: 'NO_ENERGY' })
  })

  it('drops the carried item on the free cell ahead, or on a neighbouring cell', async () => {
    const { t } = await withItem()
    const state = await t.stateOf('b1')
    await t.manipulator.handle(state, 'pick', [])

    expect(await t.manipulator.handle(state, 'drop', [])).toEqual({
      ok: true,
      data: { itemId: 'item-1', kind: 'part' }
    })
    expect(await t.world.cell(at(5, 4))).toMatchObject({ type: MapPointType.ITEM, contentId: 'item-1' })

    await t.manipulator.handle(state, 'pick', [])
    expect(await t.manipulator.handle(state, 'drop', [6, 6])).toMatchObject({ ok: true })
    expect(await t.world.cell(at(6, 6))).toMatchObject({ type: MapPointType.ITEM })
  })

  it('refuses to drop with nothing in hand, onto an occupied cell, or far away', async () => {
    const { t } = await withItem()
    const state = await t.stateOf('b1')
    expect(await t.manipulator.handle(state, 'drop', [])).toMatchObject({ ok: false, code: 'EMPTY' })

    await t.manipulator.handle(state, 'pick', [])
    t.world.setCell({ ...(await t.world.cell(at(5, 4))), type: MapPointType.RESOURCE })
    const again = await t.stateOf('b1')
    expect(await t.manipulator.handle(again, 'drop', [])).toMatchObject({ ok: false, code: 'BLOCKED' })
    expect(await t.manipulator.handle(again, 'drop', [9, 9])).toMatchObject({ ok: false, code: 'OUT_OF_RANGE' })
    await expect(t.manipulator.handle(again, 'drop', [9])).rejects.toThrow(/both x and y/)
  })

  it('cannot drop without energy', async () => {
    const { t } = await withItem()
    const state = await t.stateOf('b1')
    await t.manipulator.handle(state, 'pick', [])
    const battery = await t.typeOf('b1', 'battery')
    await t.replace('b1', { ...battery, props: { ...battery.props, value: 0 } })

    expect(await t.manipulator.handle(state, 'drop', [])).toMatchObject({ code: 'NO_ENERGY' })
  })

  it('does nothing with a broken manipulator', async () => {
    const { t } = await withItem()
    const hand = await t.typeOf('b1', 'manipulator')
    await t.replace('b1', { ...hand, condition: 0 })

    expect(await t.manipulator.handle(await t.stateOf('b1'), 'pick', [])).toMatchObject({ code: 'BROKEN_MODULE' })
  })
})

describe('CombatHandler', () => {
  async function duel() {
    const t = await setup()
    t.addBot('shooter', at(5, 5))
    t.addBot('victim', at(5, 3))
    // A sure hit that does 50 damage
    const gun = await t.typeOf('shooter', 'weapon')
    await t.replace('shooter', { ...gun, props: { ...gun.props, accuracy: 1 } })
    t.combat = new CombatHandler(t.world, t.clock, { minDamage: 1, accuracyFalloff: 0 })
    return t
  }

  const damageTaken = async (t: Awaited<ReturnType<typeof duel>>, id: string) =>
    (await t.modulesOf(id)).reduce((sum, m) => sum + (m.maxCondition - m.condition), 0)

  it('aims at a cell in reach and refuses one out of reach', async () => {
    const t = await duel()
    const state = await t.stateOf('shooter')

    expect(await t.combat.handle(state, 'aim', [5, 3])).toEqual({ ok: true, data: { distance: 2 } })
    expect(await t.combat.handle(state, 'aim', [5, 40])).toMatchObject({ ok: false, code: 'OUT_OF_RANGE' })
  })

  it('hits the bot on the target cell, damaging one of its modules', async () => {
    const t = await duel()

    const result = await t.combat.handle(await t.stateOf('shooter'), 'shoot', [5, 3])

    expect(result).toMatchObject({ ok: true, data: { rounds: 1, hits: 1, struck: { x: 5, y: 3 } } })
    expect(await damageTaken(t, 'victim')).toBeGreaterThanOrEqual(50 - 0)
  })

  it('hits the first bot on the line, not the one behind it', async () => {
    const t = await duel()
    t.addBot('between', at(5, 4))

    const result = await t.combat.handle(await t.stateOf('shooter'), 'shoot', [5, 3])

    expect(result).toMatchObject({ data: { struck: { x: 5, y: 4 } } })
    expect(await damageTaken(t, 'between')).toBeGreaterThan(0)
    expect(await damageTaken(t, 'victim')).toBe(0)
  })

  it('fires over bots in the way and splashes the neighbours when it is artillery', async () => {
    const t = await duel()
    t.addBot('between', at(5, 4))
    t.addBot('neighbour', at(6, 3))
    const gun = await t.typeOf('shooter', 'weapon')
    await t.replace('shooter', { ...gun, props: { ...gun.props, accuracy: 1, isArtillery: true } })

    const result = await t.combat.handle(await t.stateOf('shooter'), 'shoot', [5, 3])

    expect(result).toMatchObject({ data: { struck: { x: 5, y: 3 } } })
    // The shell flies over the bot in between, which only gets the splash: half the damage, to one module
    expect(await damageTaken(t, 'between')).toBe(25)
    expect(await damageTaken(t, 'neighbour')).toBe(25)
    expect(await damageTaken(t, 'victim')).toBe(50)
  })

  it('misses an empty cell, and a miss does no harm', async () => {
    const t = await duel()

    expect(await t.combat.handle(await t.stateOf('shooter'), 'shoot', [6, 5])).toMatchObject({
      ok: true,
      data: { hits: 1, struck: null }
    })
    expect(await damageTaken(t, 'victim')).toBe(0)
  })

  it('a missed shot harms nobody, and a broken weapon cannot aim', async () => {
    const t = await duel()
    const gun = await t.typeOf('shooter', 'weapon')
    await t.replace('shooter', { ...gun, props: { ...gun.props, accuracy: 0 } })

    expect(await t.combat.handle(await t.stateOf('shooter'), 'shoot', [5, 3])).toMatchObject({
      ok: true,
      data: { hits: 0, struck: null }
    })
    expect(await damageTaken(t, 'victim')).toBe(0)

    await t.replace('shooter', { ...gun, condition: 0 })
    expect(await t.combat.handle(await t.stateOf('shooter'), 'aim', [5, 3])).toMatchObject({ code: 'BROKEN_MODULE' })
  })

  it('reduces damage by armor, with a minimum', async () => {
    const t = await duel()
    const armorKit = ['armor-class1', 'battery-class1']
    t.addBot('armored', at(4, 3), armorKit)
    const armor = await t.typeOf('armored', 'armor')
    await t.replace('armored', { ...armor, props: { ...armor.props, protection: 1000 } })

    await t.combat.handle(await t.stateOf('shooter'), 'shoot', [4, 3])

    const lost = await damageTaken(t, 'armored')
    expect(lost).toBe(1)
  })

  it('cools down between shots, runs out of ammunition and loses energy', async () => {
    const t = await duel()
    const state = await t.stateOf('shooter')
    await t.combat.handle(state, 'shoot', [5, 3])

    expect(await t.combat.handle(state, 'shoot', [5, 3])).toMatchObject({ ok: false, code: 'COOLDOWN' })

    const gun = await t.typeOf('shooter', 'weapon')
    await t.replace('shooter', { ...gun, props: { ...gun.props, loaded: 0, readyAt: 0 } })
    expect(await t.combat.handle(state, 'shoot', [5, 3])).toMatchObject({ ok: false, code: 'NO_AMMO' })

    await t.replace('shooter', { ...gun, props: { ...gun.props, readyAt: 0 } })
    const battery = await t.typeOf('shooter', 'battery')
    await t.replace('shooter', { ...battery, props: { ...battery.props, value: 0 } })
    expect(await t.combat.handle(state, 'shoot', [5, 3])).toMatchObject({ ok: false, code: 'NO_ENERGY' })
  })

  it('reloads from the ammunition the bot carries and consumes it', async () => {
    const t = await duel()
    const bot = await t.worldBot('shooter')
    const gun = await t.typeOf('shooter', 'weapon')
    await t.replace('shooter', { ...gun, props: { ...gun.props, loaded: 8 } })
    for (const id of ['a1', 'a2', 'a3']) {
      t.world.setItemHolder(buildItem({ id, type: ItemType.AMMUNITION, name: 'ammo-25' }), bot)
    }

    const result = await t.combat.handle(await t.stateOf('shooter'), 'reload', [])

    expect(result).toEqual({ ok: true, data: { loaded: 10 } })
    expect(bot.carried.map((i) => i.id)).toEqual(['a3'])
    expect((await t.typeOf('shooter', 'weapon')).props.loaded).toBe(10)
  })

  it('reload with a full weapon does nothing, with no ammunition fails, and without energy fails', async () => {
    const t = await duel()
    const state = await t.stateOf('shooter')
    expect(await t.combat.handle(state, 'reload', [])).toEqual({ ok: true, data: { loaded: 10 } })

    const gun = await t.typeOf('shooter', 'weapon')
    await t.replace('shooter', { ...gun, props: { ...gun.props, loaded: 0 } })
    expect(await t.combat.handle(state, 'reload', [])).toMatchObject({ ok: false, code: 'NO_AMMO' })

    t.world.setItemHolder(buildItem({ id: 'a1', type: ItemType.AMMUNITION }), await t.worldBot('shooter'))
    const battery = await t.typeOf('shooter', 'battery')
    await t.replace('shooter', { ...battery, props: { ...battery.props, value: 0 } })
    expect(await t.combat.handle(state, 'reload', [])).toMatchObject({ ok: false, code: 'NO_ENERGY' })
  })

  it('draws the line of fire between two cells', () => {
    expect(lineBetween(at(0, 0), at(0, 3))).toEqual([at(0, 1), at(0, 2)])
    expect(lineBetween(at(0, 0), at(3, 3))).toEqual([at(1, 1), at(2, 2)])
    expect(lineBetween(at(3, 0), at(0, 1)).length).toBe(2)
    expect(lineBetween(at(0, 0), at(1, 0))).toEqual([])
  })

  it('does not fire without a bot on the map, and ignores a victim that is gone', async () => {
    const t = await duel()
    t.addBot('lost', null)
    expect(await t.combat.handle(await t.stateOf('lost'), 'aim', [1, 1])).toMatchObject({ code: 'NOT_FOUND' })

    t.placeCell(at(7, 5), { type: MapPointType.BOT, contentId: 'ghost' })
    expect(await t.combat.handle(await t.stateOf('shooter'), 'shoot', [7, 5])).toMatchObject({ ok: true })
  })
})

describe('PowerHandler', () => {
  it('switches a generator on and off and connects and disconnects a battery', async () => {
    const t = await setup()
    t.addBot('b1', at(1, 1), [...FULL_KIT, 'generator-class1'])
    const state = await t.stateOf('b1')
    const generator = await t.typeOf('b1', 'generator')
    const battery = await t.typeOf('b1', 'battery')

    expect(await t.power.handle(state, 'enable', [generator.id])).toEqual({
      ok: true,
      data: { moduleId: generator.id, isOn: true }
    })
    expect((await t.typeOf('b1', 'generator')).props.isEnabled).toBe(true)
    await t.power.handle(state, 'disable', [generator.id])
    expect((await t.typeOf('b1', 'generator')).props.isEnabled).toBe(false)
    await t.power.handle(state, 'disable', [battery.id])
    expect((await t.typeOf('b1', 'battery')).props.isConnected).toBe(false)
  })

  it('refuses a missing module, a broken generator and a module that has no switch', async () => {
    const t = await setup()
    t.addBot('b1', at(1, 1), [...FULL_KIT, 'generator-class1'])
    const state = await t.stateOf('b1')
    const generator = await t.typeOf('b1', 'generator')
    const drill = await t.typeOf('b1', 'mining')
    await t.replace('b1', { ...generator, condition: 0 })

    expect(await t.power.handle(state, 'enable', ['nope'])).toMatchObject({ ok: false, code: 'NOT_FOUND' })
    expect(await t.power.handle(state, 'enable', [generator.id])).toMatchObject({ ok: false, code: 'BROKEN_MODULE' })
    await expect(t.power.handle(state, 'enable', [drill.id])).rejects.toThrow(/cannot be switched/)
    expect(
      await t.power.handle({ ...state, bot: { ...state.bot, id: 'unknown' } }, 'enable', [generator.id])
    ).toMatchObject({
      code: 'NOT_FOUND'
    })
  })
})

describe('live scanning through enable and view', () => {
  const KIT = [...FULL_KIT, 'scanner-class1']

  it('puts a scanner into live mode and out of it, and tells the live vision', async () => {
    const t = await setup()
    t.addBot('b1', at(5, 5), KIT)
    const state = await t.stateOf('b1')
    const scanner = await t.typeOf('b1', 'scanner')
    const track = jest.spyOn(t.vision, 'track')

    expect(await t.power.handle(state, 'enable', [scanner.id])).toEqual({
      ok: true,
      data: { moduleId: scanner.id, isOn: true }
    })
    expect((await t.typeOf('b1', 'scanner')).props.isLive).toBe(true)
    expect(track).toHaveBeenCalledWith('b1')

    await t.power.handle(state, 'disable', [scanner.id])
    expect((await t.typeOf('b1', 'scanner')).props.isLive).toBe(false)
    expect(track).toHaveBeenCalledTimes(1)
  })

  it('refuses to switch a broken scanner on', async () => {
    const t = await setup()
    t.addBot('b1', at(5, 5), KIT)
    const scanner = await t.typeOf('b1', 'scanner')
    await t.replace('b1', { ...scanner, condition: 0 })

    expect(await t.power.handle(await t.stateOf('b1'), 'enable', [scanner.id])).toMatchObject({ code: 'BROKEN_MODULE' })
  })

  it('shows the live view only while the scanner is live', async () => {
    const t = await setup()
    t.addBot('b1', at(5, 5), KIT)
    const state = await t.stateOf('b1')
    const scanner = await t.typeOf('b1', 'scanner')

    expect(await t.view.handle(state, 'view', [])).toMatchObject({ ok: false, code: 'NOT_LIVE' })

    await t.power.handle(state, 'enable', [scanner.id])
    await t.vision.refresh(1, 100)
    const live = await t.view.handle(await t.stateOf('b1'), 'view', [])
    expect(live).toMatchObject({ ok: true, data: { tick: 1 } })
    expect((live as unknown as { data: { cells: unknown[] } }).data.cells).toHaveLength(9)
    expect(await t.view.handle(await t.stateOf('b1'), 'view', [1, undefined as never])).toMatchObject({
      data: { cells: [] }
    })
    expect(await t.view.handle(await t.stateOf('b1'), 'view', [null])).toMatchObject({ ok: true })
  })

  it('cannot view with a broken scanner', async () => {
    const t = await setup()
    t.addBot('b1', at(5, 5), KIT)
    const scanner = await t.typeOf('b1', 'scanner')
    await t.replace('b1', { ...scanner, condition: 0 })

    expect(await t.view.handle(await t.stateOf('b1'), 'view', [])).toMatchObject({ code: 'BROKEN_MODULE' })
  })
})

describe('GpsHandler', () => {
  it('tells the position of the bot and pays the readout', async () => {
    const t = await setup()
    t.addBot('b1', at(7, 9))
    const energy = t.world.energyOf(await t.worldBot('b1'))

    expect(await t.gps.handle(await t.stateOf('b1'))).toEqual({ ok: true, data: { x: 7, y: 9 } })
    expect(t.world.energyOf(await t.worldBot('b1'))).toBeLessThan(energy)
  })

  it('needs a working GPS module, a place on the map, and a little energy', async () => {
    const t = await setup()
    t.addBot('plain', at(1, 1), ['processor-class1', 'battery-class1'])
    t.addBot('b1', at(2, 2))
    t.addBot('lost', null)
    t.addBot('empty', at(3, 3))
    const gps = await t.typeOf('b1', 'gps')
    await t.replace('b1', { ...gps, condition: 0 })
    const battery = await t.typeOf('empty', 'battery')
    await t.replace('empty', { ...battery, props: { ...battery.props, value: 0 } })

    expect(await t.gps.handle(await t.stateOf('plain'))).toMatchObject({ code: 'NO_MODULE' })
    expect(await t.gps.handle(await t.stateOf('b1'))).toMatchObject({ code: 'BROKEN_MODULE' })
    expect(await t.gps.handle(await t.stateOf('lost'))).toMatchObject({ code: 'NOT_FOUND' })
    expect(await t.gps.handle(await t.stateOf('empty'))).toMatchObject({ code: 'NO_ENERGY' })
    expect(
      await t.gps.handle({ ...(await t.stateOf('b1')), bot: { ...(await t.stateOf('b1')).bot, id: 'unknown' } })
    ).toMatchObject({ code: 'NO_MODULE' })
  })
})

describe('SyncedHandler', () => {
  it('writes the world first and forgets what it loaded afterwards, even when the handler fails', async () => {
    const t = await setup()
    t.addBot('b1', at(1, 1))
    const bot = await t.worldBot('b1')
    t.world.turn(bot, 2)
    const inner = { functions: ['scan'], handle: jest.fn(async () => ok(1)) }
    const synced = new SyncedHandler(t.world, inner)

    expect(synced.functions).toEqual(['scan'])
    await synced.handle(bot.state, 'scan', [])

    expect(t.batches[0].headings).toEqual([{ botId: 'b1', heading: 2 }])
    expect(await t.world.bot('b1')).not.toBe(bot)

    inner.handle.mockRejectedValueOnce(new Error('boom'))
    const loaded = await t.world.bot('b1')
    await expect(synced.handle(bot.state, 'scan', [])).rejects.toThrow('boom')
    expect(await t.world.bot('b1')).not.toBe(loaded)
  })
})
