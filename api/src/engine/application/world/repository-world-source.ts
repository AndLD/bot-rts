import { RESOURCE } from '../../../../../lib/utils/interfaces/resources'
import { BotStateSource } from '../engine-ports'
import { ItemRepository } from '../../../crafting/application/item.repository'
import { MapRepository } from '../../../map/application/map.repository'
import { MapGenerator } from '../../../map/domain/map-generator'
import { Location, LocationRange } from '../../../map/domain/map-point.entity'
import { ResourceBalance } from '../../../../../lib/utils/interfaces/resources'
import { MapPointType } from '../../../../../lib/utils/interfaces/map'
import { IdGenerator } from '../../../shared/application/id-generator'
import { NewCell, StoredBot, WorldSource } from './world-source'

// The world as the repositories hold it
export class RepositoryWorldSource implements WorldSource {
  constructor(
    private readonly states: BotStateSource,
    private readonly map: MapRepository,
    private readonly items: ItemRepository,
    private readonly generator: MapGenerator,
    private readonly ids: IdGenerator,
    private readonly resources: ResourceBalance
  ) {}

  async loadBot(botId: string): Promise<StoredBot | null> {
    const state = await this.states.load(botId)
    if (!state) {
      return null
    }
    const point = await this.map.findPointByContentId(botId)
    return {
      state,
      position: point?.location ?? null,
      heading: state.bot.heading,
      carried: await this.items.listOfBot(botId)
    }
  }

  async loadCells(range: LocationRange) {
    const points = await this.map.findPointsInRange(range)
    const itemIds = points.filter((p) => p.type === MapPointType.ITEM && p.contentId).map((p) => p.contentId as string)
    return { points, items: await this.items.listByIds(itemIds) }
  }

  generate(location: Location): NewCell {
    return this.generator.generate(this.ids.next(), location, () => this.ids.next())
  }

  hardnessOf(resource: RESOURCE): number {
    return this.resources[resource].hardness
  }
}
