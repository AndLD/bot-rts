import {
  DEFAULT_CRAFTING_BALANCE,
  DEFAULT_RECIPES,
  DEFAULT_STARTER_RESOURCES
} from '../../../../lib/utils/interfaces/crafting'
import { ItemType } from '../../../../lib/utils/interfaces/items'
import { createWorld } from '../../../tests/fakes/world'
import { RecipeBook } from '../../crafting/domain/recipe-book'
import { MODULE_CATALOG } from '../../modules/domain/module-catalog'
import { EnergyModel } from '../../modules/domain/energy-model'
import { StorageModule } from '../../modules/domain/game-module'
import { AssemblyService } from './assembly.service'
import { FactoryService } from './factory.service'

const alice = { id: '11111111-1111-4111-8111-111111111111', name: 'Alice' }

// The tutorial path of design §16.1: craft a module (the hint names wheels or an engine), then assemble a bot, which needs
// a processor, a wireless adapter and a battery (design §8.2)
const FIRST_CRAFT = 'wheels-class1'
const BOT_PARTS = ['processor-class1', 'wireless-adapter-class1', 'battery-class1']

async function freshBase() {
  const world = createWorld()
  const { bot: base } = await world.botsService.deployUserBase(alice, {
    password: 'secret1',
    location: { x: 5, y: 5, z: 0 }
  })
  const factory = new FactoryService(
    world.unitOfWork,
    world.botsService,
    new RecipeBook(DEFAULT_RECIPES, DEFAULT_CRAFTING_BALANCE),
    world.clock,
    new EnergyModel(world.moduleRegistry),
    world.factorySettler
  )
  const assembly = new AssemblyService(
    world.botsService,
    world.repositories.modules,
    world.repositories.items,
    world.moduleFactory,
    world.moduleRegistry,
    world.factoryService
  )
  const storage = () => new StorageModule(world.repositories.modules.items.find((m) => m.type === 'storage') as never)
  return { ...world, base, factory, assembly, storage }
}

describe('the starter resources of a freshly deployed base (design §6.1, §16.1)', () => {
  it('affords the first craft and then the first assembly with what the deployment deposited', async () => {
    const { base, factory, assembly, repositories, clock } = await freshBase()

    await factory.craft(alice.id, base.id, FIRST_CRAFT)
    for (const part of BOT_PARTS) {
      await factory.craft(alice.id, base.id, part)
    }
    clock.current = new Date(clock.now().getTime() + 10 * 60_000)
    const parts = (await factory.status(alice.id, base.id)).parts
    const partIds = BOT_PARTS.map((name) => parts.find((part) => part.name === name)?.id as string)
    const { bot } = await assembly.assemble(alice.id, { baseId: base.id, label: null, partIds })

    expect(parts.every((part) => part.type === ItemType.PART)).toBe(true)
    expect(bot).toMatchObject({ baseId: base.id })
    expect(await repositories.bots.findById(bot.id)).not.toBeNull()
  })

  it('also affords an engine as the first craft', async () => {
    const { base, factory } = await freshBase()

    await factory.craft(alice.id, base.id, 'engine-class1')
    for (const part of BOT_PARTS) {
      await factory.craft(alice.id, base.id, part)
    }
  })

  it('keeps the starter resources within the capacity of the starter storage', () => {
    const total = DEFAULT_STARTER_RESOURCES.reduce((sum, stack) => sum + stack.amount, 0)
    const storage = MODULE_CATALOG.find((template) => template.name === 'storage-class1')

    expect(total).toBeLessThan(storage?.props.capacity as number)
  })

  it('gives a crafted storage nothing: the deposit belongs to the deployment only', async () => {
    const { base, factory, assembly, repositories, clock } = await freshBase()

    for (const part of [...BOT_PARTS, 'storage-class1']) {
      await factory.craft(alice.id, base.id, part)
    }
    clock.current = new Date(clock.now().getTime() + 10 * 60_000)
    const parts = (await factory.status(alice.id, base.id)).parts
    const { bot } = await assembly.assemble(alice.id, {
      baseId: base.id,
      label: null,
      partIds: parts.map(({ id }) => id)
    })

    const crafted = (await repositories.modules.listOfBot(bot.id)).find((module) => module.type === 'storage')
    expect(crafted?.props.items).toEqual([])
  })

  it('fits the starter storage with room left', async () => {
    const { storage } = await freshBase()

    expect(storage().used).toBeLessThanOrEqual(storage().capacity)
    expect(storage().free).toBeGreaterThan(0)
  })
})
