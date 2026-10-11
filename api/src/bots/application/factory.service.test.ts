import { DEFAULT_CRAFTING_BALANCE, DEFAULT_RECIPES } from '../../../../lib/utils/interfaces/crafting'
import { ItemType } from '../../../../lib/utils/interfaces/items'
import { createWorld } from '../../../tests/fakes/world'
import { RecipeBook } from '../../crafting/domain/recipe-book'
import { EnergyModel } from '../../modules/domain/energy-model'
import { BatteryModule, StorageModule } from '../../modules/domain/game-module'
import { FactoryService } from './factory.service'

const alice = { id: '11111111-1111-4111-8111-111111111111', name: 'Alice' }
const bob = { id: '22222222-2222-4222-8222-222222222222', name: 'Bob' }
const PASSWORD = 'secret1'

async function setup(recipes = DEFAULT_RECIPES) {
  const world = createWorld()
  const { bot: base } = await world.botsService.deployUserBase(alice, {
    password: PASSWORD,
    location: { x: 5, y: 5, z: 0 }
  })
  const service = new FactoryService(
    world.unitOfWork,
    world.botsService,
    new RecipeBook(recipes, DEFAULT_CRAFTING_BALANCE),
    world.ids,
    world.clock,
    world.moduleRegistry,
    new EnergyModel(world.moduleRegistry),
    world.moduleFactory
  )
  const modules = world.repositories.modules
  const change = (type: string, props: Record<string, unknown>, extra: Record<string, unknown> = {}) => {
    const index = modules.items.findIndex((m) => m.type === type)
    modules.items[index] = { ...modules.items[index], ...extra, props: { ...modules.items[index].props, ...props } }
  }
  const stock = (items: { resource: string; amount: number }[]) => change('storage', { capacity: 2000, items })
  const advance = (ms: number) => (world.clock.current = new Date(world.clock.now().getTime() + ms))
  const storage = () => new StorageModule(modules.items.find((m) => m.type === 'storage') as never)
  const battery = () => new BatteryModule(modules.items.find((m) => m.type === 'battery') as never)
  return { ...world, base, service, change, stock, advance, storage, battery }
}

describe('FactoryService.craft', () => {
  it('pays resources and energy now and delivers the part when the factory is done', async () => {
    const { service, base, stock, storage, battery, advance, clock } = await setup()
    stock([
      { resource: 'iron', amount: 100 },
      { resource: 'crystal', amount: 20 }
    ])

    const [job] = await service.craft(alice.id, base.id, 'scanner-class1')

    expect(job).toEqual({ kind: 'craft', module: 'scanner-class1', readyAt: clock.now().getTime() + 10_000 })
    expect(storage().amountOf('iron' as never)).toBe(80)
    expect(storage().amountOf('crystal' as never)).toBe(15)
    expect(battery().value).toBe(3000 - 40)
    expect((await service.status(alice.id, base.id)).parts).toEqual([])

    advance(10_000)
    const status = await service.status(alice.id, base.id)

    expect(status.jobs).toEqual([])
    expect(status.parts).toEqual([
      expect.objectContaining({ name: 'scanner-class1', type: ItemType.PART, botId: base.id })
    ])
  })

  it('works through several modules one after the other', async () => {
    const { service, base, stock, storage, battery, advance, clock } = await setup()
    stock([{ resource: 'iron', amount: 200 }])
    const start = clock.now().getTime()

    const jobs = await service.craft(alice.id, base.id, 'wheels-class1', 3)

    expect(jobs.map((job) => job.readyAt)).toEqual([start + 10_000, start + 20_000, start + 30_000])
    expect(storage().amountOf('iron' as never)).toBe(125)
    expect(battery().value).toBe(3000 - 120)

    advance(25_000)
    expect((await service.status(alice.id, base.id)).parts).toHaveLength(2)
    advance(10_000)
    const status = await service.status(alice.id, base.id)
    expect(status.parts).toHaveLength(3)
    expect(status.jobs).toEqual([])
  })

  it('refuses what the player does not know, does not exist or cannot be paid, and takes nothing', async () => {
    const { service, base, stock, storage, battery, change } = await setup()
    stock([{ resource: 'iron', amount: 10 }])

    await expect(service.craft(alice.id, base.id, 'scanner-class2')).rejects.toMatchObject({ code: 'NO_BLUEPRINT' })
    await expect(service.craft(alice.id, base.id, 'laser')).rejects.toMatchObject({ statusCode: 404 })
    await expect(service.craft(alice.id, base.id, 'wheels-class1')).rejects.toMatchObject({ code: 'EMPTY' })
    stock([{ resource: 'iron', amount: 100 }])
    change('battery', { value: 10 })
    await expect(service.craft(alice.id, base.id, 'wheels-class1')).rejects.toMatchObject({ code: 'NO_ENERGY' })

    expect(storage().amountOf('iron' as never)).toBe(100)
    expect(battery().value).toBe(10)
  })

  it('validates the count, the factory, the queue and who asks', async () => {
    const { service, base, stock, change } = await setup()
    stock([{ resource: 'iron', amount: 2000 }])

    await expect(service.craft(alice.id, base.id, 'wheels-class1', 0)).rejects.toThrow('Craft between 1 and 100')
    await expect(service.craft(alice.id, base.id, 'wheels-class1', 1.5)).rejects.toThrow('Craft between 1 and 100')
    await expect(service.craft(alice.id, base.id, 'wheels-class1', 101)).rejects.toThrow('Craft between 1 and 100')
    await expect(service.craft(bob.id, base.id, 'wheels-class1')).rejects.toMatchObject({ statusCode: 403 })

    change('factory', { queueSize: 2 })
    await expect(service.craft(alice.id, base.id, 'wheels-class1', 3)).rejects.toMatchObject({ code: 'BUSY' })

    change('factory', {}, { condition: 0 })
    await expect(service.craft(alice.id, base.id, 'wheels-class1')).rejects.toMatchObject({ code: 'NO_MODULE' })
  })

  it('is a job of a base, not of another bot', async () => {
    const { service, botsService, base, moduleFactory } = await setup()
    const { bot: worker } = await botsService.createBot(alice.id, {
      baseId: base.id,
      label: null,
      modules: [moduleFactory.template('processor-class1')]
    })

    await expect(service.craft(alice.id, worker.id, 'wheels-class1')).rejects.toThrow('The factory is on a base')
  })

  it('finishes nothing while the factory is broken', async () => {
    const { service, base, stock, advance, change, clock } = await setup()
    stock([{ resource: 'iron', amount: 100 }])
    await service.craft(alice.id, base.id, 'wheels-class1')
    advance(60_000)
    change('factory', {}, { condition: 0 })

    expect(await service.status(alice.id, base.id)).toEqual({
      now: clock.now().getTime(),
      jobs: [],
      parts: [],
      blueprintItems: []
    })
  })

  it('shows nothing of a base without a factory module', async () => {
    const { service, base, repositories, clock } = await setup()
    repositories.modules.items.splice(
      0,
      repositories.modules.items.length,
      ...repositories.modules.items.filter((m) => m.type !== 'factory')
    )

    expect(await service.status(alice.id, base.id)).toEqual({
      now: clock.now().getTime(),
      jobs: [],
      parts: [],
      blueprintItems: []
    })
  })
})

describe('FactoryService.research', () => {
  it('costs a multiple of the recipe and time, and makes the blueprint known when it is done', async () => {
    const { service, base, stock, storage, advance, clock, repositories } = await setup()
    stock([
      { resource: 'iron', amount: 500 },
      { resource: 'crystal', amount: 200 }
    ])

    const job = await service.research(alice.id, base.id, 'scanner-class2')

    expect(job).toEqual({ kind: 'research', module: 'scanner-class2', readyAt: clock.now().getTime() + 200_000 })
    expect(storage().amountOf('iron' as never)).toBe(300)
    expect(storage().amountOf('crystal' as never)).toBe(125)
    expect(repositories.blueprints.items).toEqual([])

    advance(200_000)
    await service.status(alice.id, base.id)

    expect(repositories.blueprints.items).toEqual([
      expect.objectContaining({ userId: alice.id, module: 'scanner-class2', source: 'research' })
    ])
    await expect(service.craft(alice.id, base.id, 'scanner-class2')).resolves.toHaveLength(1)
  })

  it('refuses a known blueprint, a second research of the same and a class whose predecessor is unknown', async () => {
    const { service, base, stock } = await setup([
      ...DEFAULT_RECIPES,
      { module: 'scanner-class3', classLevel: 3, resources: [{ resource: 'iron' as never, amount: 1 }], craftTimeMs: 1 }
    ])
    stock([
      { resource: 'iron', amount: 1000 },
      { resource: 'crystal', amount: 500 }
    ])

    await expect(service.research(alice.id, base.id, 'gun-class1')).rejects.toMatchObject({ code: 'ALREADY_EXISTS' })
    await expect(service.research(alice.id, base.id, 'scanner-class3')).rejects.toMatchObject({ code: 'NO_BLUEPRINT' })
    await expect(service.research(alice.id, base.id, 'laser')).rejects.toMatchObject({ statusCode: 404 })

    await service.research(alice.id, base.id, 'scanner-class2')
    await expect(service.research(alice.id, base.id, 'scanner-class2')).rejects.toMatchObject({
      code: 'ALREADY_EXISTS'
    })
  })

  it('needs the resources and a factory', async () => {
    const { service, base, change } = await setup()

    await expect(service.research(alice.id, base.id, 'scanner-class2')).rejects.toMatchObject({ code: 'EMPTY' })
    change('factory', {}, { condition: 0 })
    await expect(service.research(alice.id, base.id, 'scanner-class2')).rejects.toMatchObject({ code: 'NO_MODULE' })
  })
})

describe('FactoryService.learn', () => {
  const blueprintItem = (botId: string | null, name = 'scanner-class2') => ({
    id: 'bp-1',
    type: ItemType.BLUEPRINT,
    name,
    weight: 0.1,
    botId
  })

  it('uses a blueprint item up and makes the blueprint known', async () => {
    const { service, base, repositories } = await setup()
    await repositories.items.add(blueprintItem(base.id))

    const blueprint = await service.learn(alice.id, base.id, 'bp-1')

    expect(blueprint).toMatchObject({ userId: alice.id, module: 'scanner-class2', source: 'item' })
    expect(await repositories.items.findById('bp-1')).toBeNull()
    expect(await repositories.blueprints.listOfUser(alice.id)).toHaveLength(1)
    expect((await service.status(alice.id, base.id)).blueprintItems).toEqual([])
  })

  it('keeps an item it cannot use', async () => {
    const { service, base, repositories, change } = await setup()
    await repositories.items.add(blueprintItem(null))
    await repositories.items.add({ ...blueprintItem(base.id, 'gun-class1'), id: 'known' })
    await repositories.items.add({ ...blueprintItem(base.id, 'laser'), id: 'unknown' })
    await repositories.items.add({ ...blueprintItem(base.id), id: 'part', type: ItemType.PART })

    await expect(service.learn(alice.id, base.id, 'bp-1')).rejects.toMatchObject({ statusCode: 404 })
    await expect(service.learn(alice.id, base.id, 'part')).rejects.toMatchObject({ statusCode: 404 })
    await expect(service.learn(alice.id, base.id, 'missing')).rejects.toMatchObject({ statusCode: 404 })
    await expect(service.learn(alice.id, base.id, 'known')).rejects.toMatchObject({ code: 'ALREADY_EXISTS' })
    await expect(service.learn(alice.id, base.id, 'unknown')).rejects.toMatchObject({ statusCode: 404 })
    await expect(service.learn(bob.id, base.id, 'known')).rejects.toMatchObject({ statusCode: 403 })
    expect(await repositories.items.findById('known')).not.toBeNull()

    change('factory', {}, { condition: 0 })
    await expect(service.learn(alice.id, base.id, 'bp-1')).rejects.toMatchObject({ code: 'NO_MODULE' })
  })
})
