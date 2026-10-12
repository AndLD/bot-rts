import { ItemType } from '../../../../lib/utils/interfaces/items'
import { RESOURCE } from '../../../../lib/utils/interfaces/resources'
import { InMemoryItemRepository } from '../../../tests/fakes/fakes'
import { buildItem, buildModule } from '../../../tests/integration/builders'
import { BotsService } from './bots.service'
import { StorageViewService } from './storage-view.service'

const botId = 'bot-1'

async function setup(modules: ReturnType<typeof buildModule>[]) {
  const items = new InMemoryItemRepository()
  const bots = { getBotModules: jest.fn().mockResolvedValue(modules) }

  return { items, service: new StorageViewService(bots as unknown as BotsService, items), bots }
}

describe('StorageViewService', () => {
  it('sums the storages and the manipulators that work, and lists what is carried', async () => {
    const { service, items, bots } = await setup([
      buildModule(botId, {
        type: 'storage',
        props: {
          capacity: 200,
          items: [
            { resource: RESOURCE.OIL, amount: 50 },
            { resource: RESOURCE.GOLD, amount: 5 }
          ]
        }
      }),
      buildModule(botId, {
        type: 'storage',
        props: { capacity: 100, items: [{ resource: RESOURCE.OIL, amount: 10 }] }
      }),
      buildModule(botId, { type: 'manipulator', props: { loadCapacity: 50 } }),
      buildModule(botId, { type: 'manipulator', condition: 0, props: { loadCapacity: 80 } })
    ])
    await items.add(buildItem({ botId, type: ItemType.PART, weight: 2 }))
    await items.add(buildItem({ botId, type: ItemType.BLUEPRINT, weight: 0.5 }))
    await items.add(buildItem({ botId: 'other-bot' }))

    const storage = await service.of('user-1', botId)

    expect(bots.getBotModules).toHaveBeenCalledWith('user-1', botId)
    expect(storage).toMatchObject({
      capacity: 300,
      used: 65,
      resources: [
        { resource: 'oil', amount: 60 },
        { resource: 'gold', amount: 5 }
      ],
      carriedWeight: 2.5,
      loadCapacity: 50
    })
    expect(storage.items).toHaveLength(2)
  })

  it('does not count a broken storage in the capacity, but still shows what is in it', async () => {
    const { service } = await setup([
      buildModule(botId, {
        type: 'storage',
        condition: 0,
        props: { capacity: 200, items: [{ resource: RESOURCE.IRON, amount: 7 }] }
      })
    ])

    expect(await service.of('user-1', botId)).toMatchObject({
      capacity: 0,
      used: 0,
      resources: [{ resource: 'iron', amount: 7 }],
      loadCapacity: 0,
      items: []
    })
  })
})
