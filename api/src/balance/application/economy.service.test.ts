import { DEFAULT_WORLD_CONFIG } from '../../map/domain/world-config'
import { EconomyService } from './economy.service'
import { EconomyReadModel } from './ports'

const resources = DEFAULT_WORLD_CONFIG.resources

describe('EconomyService', () => {
  it('reports every resource with its deposits and stock, the blueprints by module and the modules by count', async () => {
    const readModel: EconomyReadModel = {
      deposits: async () => [{ resource: 'iron', deposits: 4, remaining: 300 }],
      stored: async () => [{ resource: 'iron', amount: 12 }],
      blueprints: async () => [
        { module: 'gun-class2', source: 'research', players: 2 },
        { module: 'gun-class2', source: 'item', players: 1 },
        { module: 'scanner-class2', source: 'item', players: 5 }
      ],
      modules: async () => [
        { type: 'gun', name: 'gun-class1', count: 2 },
        { type: 'scanner', name: 'scanner-class1', count: 9 }
      ]
    }

    const overview = await new EconomyService(readModel, resources).overview()

    expect(overview.resources.find((stat) => stat.resource === 'iron')).toEqual({
      resource: 'iron',
      deposits: 4,
      remaining: 300,
      capacity: 4 * resources.iron.maxAmount,
      stored: 12
    })
    expect(overview.resources.find((stat) => stat.resource === 'gold')).toMatchObject({ deposits: 0, stored: 0 })
    expect(overview.blueprints).toEqual([
      { module: 'scanner-class2', research: 0, item: 5 },
      { module: 'gun-class2', research: 2, item: 1 }
    ])
    expect(overview.modules.map(({ name }) => name)).toEqual(['scanner-class1', 'gun-class1'])
  })
})
