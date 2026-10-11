import { MapPointType } from '../../../../lib/utils/interfaces/map'
import { Rng } from '../../shared/application/rng'
import { Location, MapPoint } from './map-point.entity'
import { pickResource, rollDepositAmount } from './resource-balance'
import { WorldConfig } from './world-config'

// Rolls the content of a cell that nobody has seen yet (design §4.2): empty, or a deposit of a weighted random resource
export class MapGenerator {
  constructor(
    private readonly rng: Rng,
    private readonly world: Pick<WorldConfig, 'resourceChance' | 'resources'>
  ) {}

  generate(id: string, location: Location): MapPoint {
    if (this.rng.next() >= this.world.resourceChance) {
      return { id, location, type: null, contentId: null, resource: null }
    }

    const resource = pickResource(this.world.resources, this.rng.next())
    const amount = rollDepositAmount(this.world.resources[resource], this.rng.next())
    return { id, location, type: MapPointType.RESOURCE, contentId: null, resource: { resource, amount } }
  }
}
