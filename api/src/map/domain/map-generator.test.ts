import { ItemType } from '../../../../lib/utils/interfaces/items'
import { MapPointType } from '../../../../lib/utils/interfaces/map'
import { DEFAULT_RESOURCE_BALANCE, RESOURCE } from '../../../../lib/utils/interfaces/resources'
import { FixedRng } from '../../../tests/fakes/fakes'
import { MapGenerator } from './map-generator'

const location = { x: 3, y: -4, z: 0 }
const world = { resourceChance: 0.2, resources: DEFAULT_RESOURCE_BALANCE }
const blueprints = { chance: 0.01, modules: ['scanner-class2', 'gun-class2', 'drill-class2'] }
const newItemId = () => 'item-1'

describe('MapGenerator', () => {
  it('generates an empty cell above the resource chance with a single roll', () => {
    const generator = new MapGenerator(new FixedRng([0.2]), world)

    expect(generator.generate('p1', location, newItemId)).toEqual({
      point: { id: 'p1', location, type: null, contentId: null, resource: null },
      item: null
    })
  })

  it('generates a deposit of a weighted resource with an amount from its range', () => {
    // chance roll 0.19, kind roll 0.97 -> gold (10..40), amount roll 0.5 -> 25
    const generator = new MapGenerator(new FixedRng([0.19, 0.97, 0.5]), world)

    expect(generator.generate('p1', location, newItemId).point).toMatchObject({
      type: MapPointType.RESOURCE,
      resource: { resource: RESOURCE.GOLD, amount: 25 }
    })
  })

  it('puts a blueprint item of a random module on a few empty cells', () => {
    // not a resource (0.5), a blueprint (0.005 < 0.01), the second module (0.5 -> index 1)
    const generator = new MapGenerator(new FixedRng([0.5, 0.005, 0.5]), world, blueprints)

    expect(generator.generate('p1', location, newItemId)).toEqual({
      point: { id: 'p1', location, type: MapPointType.ITEM, contentId: 'item-1', resource: null },
      item: { id: 'item-1', type: ItemType.BLUEPRINT, name: 'gun-class2', weight: 0.1, botId: null }
    })
  })

  it('leaves most empty cells empty, and never puts a blueprint on a deposit', () => {
    expect(new MapGenerator(new FixedRng([0.5, 0.5]), world, blueprints).generate('p1', location, newItemId)).toEqual({
      point: { id: 'p1', location, type: null, contentId: null, resource: null },
      item: null
    })
    expect(
      new MapGenerator(new FixedRng([0.1, 0.1, 0.1]), world, blueprints).generate('p1', location, newItemId).item
    ).toBeNull()
  })

  it('needs modules to hold blueprints of', () => {
    const generator = new MapGenerator(new FixedRng([0.5]), world, { chance: 1, modules: [] })

    expect(generator.generate('p1', location, newItemId).item).toBeNull()
  })
})
