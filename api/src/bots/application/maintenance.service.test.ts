import { MapPointType } from '../../../../lib/utils/interfaces/map'
import { FixedRng } from '../../../tests/fakes/fakes'
import { createWorld } from '../../../tests/fakes/world'
import { Location } from '../../map/domain/map-point.entity'
import { BatteryModule, StorageModule } from '../../modules/domain/game-module'

const alice = { id: '11111111-1111-4111-8111-111111111111', name: 'Alice' }
const bob = { id: '22222222-2222-4222-8222-222222222222', name: 'Bob' }
const PASSWORD = 'secret1'
const KIT = ['processor-class1', 'wireless-adapter-class1', 'battery-class1', 'storage-class1', 'repair-class1']

async function setup() {
  const world = createWorld()
  const { repositories, botsService, moduleFactory } = world
  const { bot: base } = await botsService.deployUserBase(alice, { password: PASSWORD, location: { x: 5, y: 5, z: 0 } })
  const { bot: medic, mapPoint } = await botsService.createBot(alice.id, {
    baseId: base.id,
    label: 'Medic',
    modules: KIT.map((name) => moduleFactory.template(name))
  })

  const modulesOf = (botId: string) => repositories.modules.items.filter((m) => m.botId === botId)
  const find = (botId: string, type: string) => modulesOf(botId).find((m) => m.type === type)!
  const replace = (id: string, change: Record<string, unknown>, props: Record<string, unknown> = {}) => {
    const index = repositories.modules.items.findIndex((m) => m.id === id)
    const module = repositories.modules.items[index]
    repositories.modules.items[index] = { ...module, ...change, props: { ...module.props, ...props } }
  }
  const stock = (items: { resource: string; amount: number }[]) =>
    replace(find(medic.id, 'storage').id, {}, { capacity: 500, items })
  const advance = (ms: number) => (world.clock.current = new Date(world.clock.now().getTime() + ms))
  const storage = () => new StorageModule(find(medic.id, 'storage'))
  const battery = () => new BatteryModule(find(medic.id, 'battery'))
  const order = (targetBotId: string, moduleId: string) => ({ repairerId: medic.id, targetBotId, moduleId })
  // Puts a bot on another cell (movement itself arrives with the engine)
  const move = async (botId: string, location: Location) => {
    const point = (await repositories.map.findPointByContentId(botId))!
    repositories.map.points.delete(`${point.location.x}:${point.location.y}:${point.location.z ?? 0}`)
    await repositories.map.upsertPoint({ ...point, location })
  }
  const free = async (around: Location): Promise<Location> => {
    for (const [dx, dy] of [
      [1, 0],
      [0, 1],
      [-1, 0],
      [0, -1],
      [1, 1],
      [-1, -1],
      [1, -1],
      [-1, 1]
    ]) {
      const location = { x: around.x + dx, y: around.y + dy, z: 0 }
      if (!(await repositories.map.findPointsInRange({ from: location, to: location })).length) {
        return location
      }
    }
    throw new Error('no free cell')
  }
  return {
    ...world,
    base,
    medic,
    medicAt: mapPoint.location,
    modulesOf,
    find,
    replace,
    stock,
    advance,
    storage,
    battery,
    order,
    free,
    move
  }
}

describe('MaintenanceService.repair', () => {
  it('restores condition of a module of an adjacent bot at the cost of resources and energy', async () => {
    const { maintenanceService, base, medic, find, replace, stock, storage, battery, order } = await setup()
    stock([{ resource: 'iron', amount: 100 }])
    const gun = find(base.id, 'weapon')
    replace(gun.id, { condition: 50 })

    const repaired = await maintenanceService.repair(alice.id, order(base.id, gun.id))

    expect(repaired.condition).toBe(75)
    expect(find(base.id, 'weapon').condition).toBe(75)
    expect(storage().amountOf('iron' as never)).toBe(93)
    expect(battery().value).toBe(3000 - 5)
    expect(find(medic.id, 'repair').props.readyAt).toBeGreaterThan(0)
  })

  it('has to wait between operations', async () => {
    const { maintenanceService, base, find, replace, stock, advance, order } = await setup()
    stock([{ resource: 'iron', amount: 100 }])
    const gun = find(base.id, 'weapon')
    replace(gun.id, { condition: 10 + 40 })

    await maintenanceService.repair(alice.id, order(base.id, gun.id))
    await expect(maintenanceService.repair(alice.id, order(base.id, gun.id))).rejects.toMatchObject({
      code: 'COOLDOWN'
    })

    advance(1000)
    await expect(maintenanceService.repair(alice.id, order(base.id, gun.id))).resolves.toMatchObject({ condition: 100 })
    advance(1000)
    await expect(maintenanceService.repair(alice.id, order(base.id, gun.id))).rejects.toMatchObject({ code: 'EMPTY' })
  })

  it('does not repair a module that is too damaged, and takes nothing from the repairer for a refusal', async () => {
    const { maintenanceService, base, find, replace, stock, storage, order } = await setup()
    stock([{ resource: 'iron', amount: 100 }])
    const gun = find(base.id, 'weapon')
    replace(gun.id, { condition: 10 })

    await expect(maintenanceService.repair(alice.id, order(base.id, gun.id))).rejects.toMatchObject({ code: 'TOO_LOW' })
    expect(storage().amountOf('iron' as never)).toBe(100)
  })

  it('needs the resources and the energy', async () => {
    const { maintenanceService, base, medic, find, replace, stock, battery, order } = await setup()
    const gun = find(base.id, 'weapon')
    replace(gun.id, { condition: 50 })

    await expect(maintenanceService.repair(alice.id, order(base.id, gun.id))).rejects.toMatchObject({ code: 'EMPTY' })
    stock([{ resource: 'iron', amount: 100 }])
    replace(find(medic.id, 'battery').id, {}, { value: 1 })
    await expect(maintenanceService.repair(alice.id, order(base.id, gun.id))).rejects.toMatchObject({
      code: 'NO_ENERGY'
    })
    expect(battery().value).toBe(1)
    expect(find(base.id, 'weapon').condition).toBe(50)
  })

  it('works only on an adjacent bot, never on itself', async () => {
    const { maintenanceService, base, medic, find, replace, repositories, order, move } = await setup()
    const gun = find(base.id, 'weapon')
    replace(gun.id, { condition: 50 })

    await expect(maintenanceService.repair(alice.id, order(medic.id, gun.id))).rejects.toThrow(
      'A bot cannot work on itself'
    )

    await move(medic.id, { x: 9, y: 9, z: 0 })
    await expect(maintenanceService.repair(alice.id, order(base.id, gun.id))).rejects.toMatchObject({
      code: 'OUT_OF_RANGE'
    })

    repositories.map.points.clear()
    await expect(maintenanceService.repair(alice.id, order(base.id, gun.id))).rejects.toThrow('Bot location not found')
  })

  it('needs a known target and module and a working repair module of the player', async () => {
    const { maintenanceService, base, medic, find, replace, order } = await setup()
    const gun = find(base.id, 'weapon')

    await expect(maintenanceService.repair(alice.id, order('missing', gun.id))).rejects.toMatchObject({
      statusCode: 404
    })
    await expect(maintenanceService.repair(alice.id, order(base.id, 'missing'))).rejects.toThrow('no such module')
    await expect(maintenanceService.repair(bob.id, order(base.id, gun.id))).rejects.toMatchObject({ statusCode: 403 })

    replace(find(medic.id, 'repair').id, { condition: 0 })
    await expect(maintenanceService.repair(alice.id, order(base.id, gun.id))).rejects.toMatchObject({
      code: 'NO_MODULE'
    })
  })

  it('repairs a module of another player, which needs no permission', async () => {
    const { maintenanceService, botsService, medicAt, stock, free, replace, order, modulesOf } = await setup()
    stock([{ resource: 'iron', amount: 100 }])
    const { bot: bobBase } = await botsService.deployUserBase(bob, {
      password: PASSWORD,
      location: await free(medicAt)
    })
    const gun = modulesOf(bobBase.id).find((m) => m.type === 'weapon')!
    replace(gun.id, { condition: 50 })

    await expect(maintenanceService.repair(alice.id, order(bobBase.id, gun.id))).resolves.toMatchObject({
      condition: 75
    })
  })

  it('gives a corpse base back to its owner and shows it on the map again', async () => {
    const world = await setup()
    const { maintenanceService, botsService, base, find, replace, repositories } = world
    const adapter = find(base.id, 'wirelessAdapter')
    replace(adapter.id, { condition: 0 })
    const { bot: newBase } = await botsService.deployUserBase(alice, {
      password: PASSWORD,
      location: { x: 7, y: 5, z: 0 }
    })
    expect(await repositories.map.findPointByContentId(base.id)).toMatchObject({ type: MapPointType.CORPSE_BASE })

    const { bot: helper } = await botsService.createBot(alice.id, {
      baseId: newBase.id,
      label: null,
      modules: KIT.map((name) => world.moduleFactory.template(name))
    })
    await world.move(helper.id, { x: 6, y: 5, z: 0 })
    const storage = find(helper.id, 'storage')
    replace(
      storage.id,
      {},
      {
        capacity: 500,
        items: [
          { resource: 'crystal', amount: 100 },
          { resource: 'gold', amount: 100 }
        ]
      }
    )

    for (let step = 0; step < 4; step++) {
      world.advance(1000)
      await maintenanceService.repair(alice.id, { repairerId: helper.id, targetBotId: base.id, moduleId: adapter.id })
    }

    expect(find(base.id, 'wirelessAdapter').condition).toBe(100)
    expect(await repositories.map.findPointByContentId(base.id)).toMatchObject({ type: MapPointType.BASE })
    expect(await botsService.listUserBots(alice.id)).toHaveLength(4)
  })
})

describe('MaintenanceService.disassemble', () => {
  it('takes a module of an own bot apart into scrap and removes it', async () => {
    const { maintenanceService, base, medic, find, modulesOf, stock, storage, order } = await setup()
    stock([])
    const gun = find(base.id, 'weapon')

    const { scrap, blueprint } = await maintenanceService.disassemble(alice.id, order(base.id, gun.id))

    // the middle of the 30-50 % of the 50 iron of the recipe
    expect(scrap).toEqual([{ resource: 'iron', amount: 20 }])
    expect(blueprint).toBeNull()
    expect(storage().amountOf('iron' as never)).toBe(20)
    expect(modulesOf(base.id).some((m) => m.id === gun.id)).toBe(false)
    expect(find(medic.id, 'repair').props.readyAt).toBeGreaterThan(0)
  })

  it('shows a base as a corpse when its wireless adapter is taken apart', async () => {
    const { maintenanceService, base, find, repositories, stock, order } = await setup()
    stock([])

    await maintenanceService.disassemble(alice.id, order(base.id, find(base.id, 'wirelessAdapter').id))

    expect(await repositories.map.findPointByContentId(base.id)).toMatchObject({ type: MapPointType.CORPSE_BASE })
  })

  it('refuses when the scrap does not fit, and keeps the module', async () => {
    const { maintenanceService, base, find, modulesOf, replace, medic, order } = await setup()
    replace(find(medic.id, 'storage').id, {}, { capacity: 5, items: [] })
    const gun = find(base.id, 'weapon')

    await expect(maintenanceService.disassemble(alice.id, order(base.id, gun.id))).rejects.toMatchObject({
      code: 'NO_SPACE'
    })
    expect(modulesOf(base.id).some((m) => m.id === gun.id)).toBe(true)
  })

  it('strips only broken modules of other players', async () => {
    const { maintenanceService, botsService, medicAt, free, modulesOf, replace, stock, order } = await setup()
    stock([])
    const { bot: bobBase } = await botsService.deployUserBase(bob, {
      password: PASSWORD,
      location: await free(medicAt)
    })
    const gun = modulesOf(bobBase.id).find((m) => m.type === 'weapon')!

    await expect(maintenanceService.disassemble(alice.id, order(bobBase.id, gun.id))).rejects.toMatchObject({
      code: 'FORBIDDEN'
    })
    replace(gun.id, { condition: 0 })
    await expect(maintenanceService.disassemble(alice.id, order(bobBase.id, gun.id))).resolves.toMatchObject({
      scrap: [expect.anything()]
    })
  })

  it("finds the owner of a bot through its base: own bots may be stripped, other players' only when broken", async () => {
    const {
      maintenanceService,
      botsService,
      moduleFactory,
      base,
      medicAt,
      modulesOf,
      replace,
      stock,
      order,
      move,
      advance
    } = await setup()
    stock([])
    const place = (botId: string) => move(botId, { x: medicAt.x, y: medicAt.y + 1, z: 0 })
    const { bot: ownBot } = await botsService.createBot(alice.id, {
      baseId: base.id,
      label: null,
      modules: [moduleFactory.template('storage-class1')]
    })
    await place(ownBot.id)
    await expect(
      maintenanceService.disassemble(alice.id, order(ownBot.id, modulesOf(ownBot.id)[0].id))
    ).resolves.toBeDefined()

    advance(1000)
    const { bot: bobBase } = await botsService.deployUserBase(bob, {
      password: PASSWORD,
      location: { x: 30, y: 30, z: 0 }
    })
    const { bot: bobBot } = await botsService.createBot(bob.id, {
      baseId: bobBase.id,
      label: null,
      modules: [moduleFactory.template('storage-class1')]
    })
    await place(bobBot.id)
    const storage = modulesOf(bobBot.id)[0]
    await expect(maintenanceService.disassemble(alice.id, order(bobBot.id, storage.id))).rejects.toMatchObject({
      code: 'FORBIDDEN'
    })
    replace(storage.id, { condition: 0 })
    await expect(maintenanceService.disassemble(alice.id, order(bobBot.id, storage.id))).resolves.toBeDefined()
  })

  it("treats a bot that has no owner as nobody's: only its broken modules can be taken apart", async () => {
    const { maintenanceService, repositories, medicAt, free, moduleFactory, replace, stock, advance, order } =
      await setup()
    stock([])
    for (const [id, baseId] of [
      ['orphan', null],
      ['lost-base', 'gone']
    ] as const) {
      const location = await free(medicAt)
      repositories.bots.items.set(id, {
        id,
        label: null,
        type: 'worker' as never,
        userId: null,
        baseId,
        passwordHash: null
      })
      const module = { ...moduleFactory.create('storage-class1', id), id: `${id}-storage` }
      repositories.modules.items.push(module)
      await repositories.map.upsertPoint({
        id: `${id}-point`,
        location,
        type: 'bot' as never,
        contentId: id,
        resource: null
      })

      await expect(maintenanceService.disassemble(alice.id, order(id, module.id))).rejects.toMatchObject({
        code: 'FORBIDDEN'
      })
      replace(module.id, { condition: 0 })
      await expect(maintenanceService.disassemble(alice.id, order(id, module.id))).resolves.toBeDefined()
      advance(1000)
    }
  })

  it('may give away the blueprint of the module, which the bot then carries', async () => {
    const world = createWorld({ rng: new FixedRng([0.5, 0.01]) })
    const { bot: base } = await world.botsService.deployUserBase(alice, {
      password: PASSWORD,
      location: { x: 5, y: 5, z: 0 }
    })
    const { bot: medic } = await world.botsService.createBot(alice.id, {
      baseId: base.id,
      label: null,
      modules: KIT.map((name) => world.moduleFactory.template(name))
    })
    const gun = world.repositories.modules.items.find((m) => m.botId === base.id && m.type === 'weapon')!

    const { blueprint } = await world.maintenanceService.disassemble(alice.id, {
      repairerId: medic.id,
      targetBotId: base.id,
      moduleId: gun.id
    })

    expect(blueprint).toMatchObject({ type: 'blueprint', name: 'gun-class1', botId: medic.id })
    expect(await world.repositories.items.findById(blueprint!.id)).toEqual(blueprint)
  })

  it('gives no blueprint from a corpse base', async () => {
    const world = createWorld({ rng: new FixedRng([0.5, 0.01]) })
    const { bot: base } = await world.botsService.deployUserBase(alice, {
      password: PASSWORD,
      location: { x: 5, y: 5, z: 0 }
    })
    const adapter = world.repositories.modules.items.find((m) => m.botId === base.id && m.type === 'wirelessAdapter')!
    world.repositories.modules.items[world.repositories.modules.items.indexOf(adapter)] = { ...adapter, condition: 0 }
    const gun = world.repositories.modules.items.find((m) => m.botId === base.id && m.type === 'weapon')!

    // The bots of the corpse are stale, so a bot of the player's new base does the work
    const { bot: newBase } = await world.botsService.deployUserBase(alice, {
      password: PASSWORD,
      location: { x: 40, y: 40, z: 0 }
    })
    const { bot: medic, mapPoint } = await world.botsService.createBot(alice.id, {
      baseId: newBase.id,
      label: null,
      modules: KIT.map((name) => world.moduleFactory.template(name))
    })
    world.repositories.map.points.delete(`${mapPoint.location.x}:${mapPoint.location.y}:${mapPoint.location.z}`)
    await world.repositories.map.upsertPoint({ ...mapPoint, location: { x: 5, y: 6, z: 0 } })

    const { blueprint } = await world.maintenanceService.disassemble(alice.id, {
      repairerId: medic.id,
      targetBotId: base.id,
      moduleId: gun.id
    })

    expect(blueprint).toBeNull()
  })
})
