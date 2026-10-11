import { ItemType } from '../../../../lib/utils/interfaces/items'
import { createWorld } from '../../../tests/fakes/world'
import { AssemblyService } from './assembly.service'

const alice = { id: '11111111-1111-4111-8111-111111111111', name: 'Alice' }
const bob = { id: '22222222-2222-4222-8222-222222222222', name: 'Bob' }
const PASSWORD = 'secret1'
const CORE = ['processor-class1', 'wireless-adapter-class1', 'battery-class1']

async function setup() {
  const world = createWorld()
  const { bot: base } = await world.botsService.deployUserBase(alice, {
    password: PASSWORD,
    location: { x: 5, y: 5, z: 0 }
  })
  const service = new AssemblyService(
    world.botsService,
    world.repositories.modules,
    world.repositories.items,
    world.moduleFactory,
    world.moduleRegistry
  )
  let counter = 0
  const part = async (name: string, overrides = {}) => {
    const id = `part-${++counter}`
    await world.repositories.items.add({ id, type: ItemType.PART, name, weight: 1, botId: base.id, ...overrides })
    return id
  }
  const parts = (names: string[]) => Promise.all(names.map((name) => part(name)))
  return { ...world, base, service, part, parts }
}

describe('AssemblyService.assemble', () => {
  it('builds a bot from the parts next to the base and uses the parts up', async () => {
    const { service, parts, base, repositories } = await setup()
    const partIds = await parts([...CORE, 'scanner-class1'])

    const { bot, modules, mapPoint } = await service.assemble(alice.id, { baseId: base.id, label: 'Scout', partIds })

    expect(bot).toMatchObject({ label: 'Scout', baseId: base.id, userId: null })
    expect(modules.map((m) => m.name).sort()).toEqual([...CORE, 'scanner-class1'].sort())
    expect(Math.max(Math.abs(mapPoint.location.x - 5), Math.abs(mapPoint.location.y - 5))).toBe(1)
    expect(await repositories.items.listOfBot(base.id)).toEqual([])
  })

  it('refuses an illegal build and keeps the parts', async () => {
    const { service, parts, base, repositories } = await setup()
    const partIds = await parts(['processor-class1', 'scanner-class1'])

    await expect(service.assemble(alice.id, { baseId: base.id, label: null, partIds })).rejects.toMatchObject({
      statusCode: 409,
      code: 'NO_MODULE'
    })
    expect(await repositories.items.listOfBot(base.id)).toHaveLength(2)
  })

  it('needs a working factory on the base', async () => {
    const { service, parts, base, repositories } = await setup()
    const partIds = await parts(CORE)
    const index = repositories.modules.items.findIndex((m) => m.type === 'factory')
    repositories.modules.items[index] = { ...repositories.modules.items[index], condition: 0 }

    await expect(service.assemble(alice.id, { baseId: base.id, label: null, partIds })).rejects.toMatchObject({
      code: 'NO_MODULE'
    })
  })

  it('takes only parts the base holds, each once', async () => {
    const { service, parts, part, base } = await setup()
    const partIds = await parts(CORE)
    const blueprint = await part('scanner-class2', { type: ItemType.BLUEPRINT })
    const elsewhere = await part('scanner-class1', { botId: null })

    await expect(
      service.assemble(alice.id, { baseId: base.id, label: null, partIds: [...partIds, blueprint] })
    ).rejects.toThrow('The base holds no part')
    await expect(
      service.assemble(alice.id, { baseId: base.id, label: null, partIds: [...partIds, elsewhere] })
    ).rejects.toThrow('The base holds no part')
    await expect(
      service.assemble(alice.id, { baseId: base.id, label: null, partIds: [...partIds, partIds[0]] })
    ).rejects.toThrow('A part can be used once')
  })

  it('is for the owner of a base only', async () => {
    const { service, parts, base, worker } = await withWorker()

    await expect(
      service.assemble(bob.id, { baseId: base.id, label: null, partIds: await parts(CORE) })
    ).rejects.toMatchObject({
      statusCode: 403
    })
    await expect(service.assemble(alice.id, { baseId: worker.id, label: null, partIds: [] })).rejects.toThrow(
      'A bot belongs to a base'
    )

    async function withWorker() {
      const context = await setup()
      const { bot: worker } = await context.botsService.createBot(alice.id, {
        baseId: context.base.id,
        label: null,
        modules: [context.moduleFactory.template('processor-class1')]
      })
      return { ...context, worker }
    }
  })
})
