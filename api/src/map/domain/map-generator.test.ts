import { MapPointType } from '../../../../lib/utils/interfaces/map'
import { DEFAULT_RESOURCE_BALANCE, RESOURCE } from '../../../../lib/utils/interfaces/resources'
import { FixedRng } from '../../../tests/fakes/fakes'
import { MapGenerator } from './map-generator'

const location = { x: 3, y: -4, z: 0 }
const world = { resourceChance: 0.2, resources: DEFAULT_RESOURCE_BALANCE }

describe('MapGenerator', () => {
  it('generates an empty cell above the resource chance with a single roll', () => {
    const generator = new MapGenerator(new FixedRng([0.2]), world)

    expect(generator.generate('p1', location)).toEqual({
      id: 'p1',
      location,
      type: null,
      contentId: null,
      resource: null
    })
  })

  it('generates a deposit of a weighted resource with an amount from its range', () => {
    // chance roll 0.19, kind roll 0.97 -> gold (10..40), amount roll 0.5 -> 25
    const generator = new MapGenerator(new FixedRng([0.19, 0.97, 0.5]), world)

    expect(generator.generate('p1', location)).toMatchObject({
      type: MapPointType.RESOURCE,
      resource: { resource: RESOURCE.GOLD, amount: 25 }
    })
  })
})
