import { MapPointType } from '../../../../lib/utils/interfaces/map'
import { ItemType } from '../../../../lib/utils/interfaces/items'
import { Item } from '../../crafting/domain/item.entity'
import { Rng } from '../../shared/application/rng'
import { Location, MapPoint } from './map-point.entity'
import { pickResource, rollDepositAmount } from './resource-balance'
import { WorldConfig } from './world-config'

// How often an empty cell holds a blueprint item, and of which modules (design §9.3)
export interface BlueprintSpawn {
  chance: number
  modules: readonly string[]
}

// What a new cell holds: the cell, and the item lying on it when it holds one
export interface GeneratedCell {
  point: MapPoint
  item: Item | null
}

// kg
const BLUEPRINT_WEIGHT = 0.1

// Rolls the content of a cell that nobody has seen yet (design §4.2): a deposit of a weighted random resource, a
// blueprint item for a random module, or nothing
export class MapGenerator {
  constructor(
    private readonly rng: Rng,
    private readonly world: Pick<WorldConfig, 'resourceChance' | 'resources'>,
    private readonly blueprints: BlueprintSpawn = { chance: 0, modules: [] }
  ) {}

  generate(id: string, location: Location, newItemId: () => string): GeneratedCell {
    if (this.rng.next() >= this.world.resourceChance) {
      return this.emptyOrBlueprint(id, location, newItemId)
    }

    const resource = pickResource(this.world.resources, this.rng.next())
    const amount = rollDepositAmount(this.world.resources[resource], this.rng.next())
    return {
      point: { id, location, type: MapPointType.RESOURCE, contentId: null, resource: { resource, amount } },
      item: null
    }
  }

  private emptyOrBlueprint(id: string, location: Location, newItemId: () => string): GeneratedCell {
    const { chance, modules } = this.blueprints
    if (!modules.length || this.rng.next() >= chance) {
      return { point: { id, location, type: null, contentId: null, resource: null }, item: null }
    }

    const item: Item = {
      id: newItemId(),
      type: ItemType.BLUEPRINT,
      name: modules[Math.floor(this.rng.next() * modules.length)],
      weight: BLUEPRINT_WEIGHT,
      botId: null
    }
    return { point: { id, location, type: MapPointType.ITEM, contentId: item.id, resource: null }, item }
  }
}
