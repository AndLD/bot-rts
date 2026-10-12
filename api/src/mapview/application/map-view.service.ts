import {
  ILiveArea,
  IMapCell,
  IMapRange,
  IMapView,
  MAP_VIEW_MAX_SIDE,
  MapPointType
} from '../../../../lib/utils/interfaces/map'
import { ItemType } from '../../../../lib/utils/interfaces/items'
import { ResourceBalance } from '../../../../lib/utils/interfaces/resources'
import { BotRepository } from '../../bots/application/bot.repository'
import { ItemRepository } from '../../crafting/application/item.repository'
import { MapRepository } from '../../map/application/map.repository'
import { locationKey } from '../../map/domain/location'
import { MapPoint } from '../../map/domain/map-point.entity'
import { ModuleRepository } from '../../modules/application/module.repository'
import { Clock } from '../../shared/application/clock'
import { NotFoundError, ValidationError } from '../../shared/domain/errors'
import { chassisOf, iconsOf, isDamaged } from '../domain/map-look'

export const LIVE_AREA_SOURCE = Symbol('LiveAreaSource')

// Where the squares a player's scanners keep live are known
export interface LiveAreaSource {
  areasOf(userId: string): ILiveArea[]
}

// A cell as the engine or the database knows it; `seenAt` is the moment it was looked at
type Sighting = Pick<MapPoint, 'type' | 'contentId' | 'resource'> & {
  location: { x: number; y: number }
  seenAt: number
}

const BODY_TYPES: ReadonlySet<MapPointType | null> = new Set([
  MapPointType.BOT,
  MapPointType.BASE,
  MapPointType.CORPSE_BASE
])

const ITEM_KINDS: Record<ItemType, NonNullable<IMapCell['item']>> = {
  [ItemType.BLUEPRINT]: 'blueprint',
  [ItemType.AMMUNITION]: 'ammunition',
  [ItemType.PART]: 'part'
}

// The player's map (design §4.2): only what they have seen, so unknown cells are simply absent (fog of war). The cells of
// their own bots and bases are always current. Other bots and items are what they were when last seen.
export class MapViewService {
  constructor(
    private readonly maps: MapRepository,
    private readonly bots: BotRepository,
    private readonly modules: ModuleRepository,
    private readonly items: ItemRepository,
    private readonly clock: Clock,
    private readonly areas: LiveAreaSource,
    private readonly resources: ResourceBalance
  ) {}

  async view(userId: string, range: IMapRange): Promise<IMapView> {
    this.validate(range)
    const locations = { from: { x: range.minX, y: range.minY, z: 0 }, to: { x: range.maxX, y: range.maxY, z: 0 } }
    const now = this.clock.now().getTime()
    const ownIds = await this.ownIds(userId)
    const sightings = new Map<string, Sighting>()

    for (const point of await this.maps.findKnownPointsInRange(userId, locations)) {
      sightings.set(locationKey(point.location), point)
    }
    for (const point of await this.maps.findPointsInRange(locations)) {
      if (point.contentId && ownIds.has(point.contentId)) {
        sightings.set(locationKey(point.location), { ...point, seenAt: now })
      }
    }

    return {
      now,
      cells: await this.compose(userId, [...sightings.values()], ownIds),
      liveAreas: this.areas.areasOf(userId)
    }
  }

  // Where one of the player's own bots stands (a player always knows where their own bots are)
  async positionOf(userId: string, botId: string): Promise<{ x: number; y: number }> {
    const point = (await this.ownIds(userId)).has(botId) ? await this.maps.findPointByContentId(botId) : null

    if (!point) {
      throw new NotFoundError('Bot not found on the map')
    }

    return { x: point.location.x, y: point.location.y }
  }

  // Turns sightings into the cells the player's client draws
  async compose(userId: string, sightings: readonly Sighting[], ownIds?: ReadonlySet<string>): Promise<IMapCell[]> {
    const own = ownIds ?? (await this.ownIds(userId))
    const botIds = sightings.filter((s) => s.type === MapPointType.BOT && s.contentId).map((s) => s.contentId as string)
    const itemIds = sightings
      .filter((s) => s.type === MapPointType.ITEM && s.contentId)
      .map((s) => s.contentId as string)
    const modulesByBot = new Map<string, Awaited<ReturnType<ModuleRepository['listOfBots']>>>()
    for (const module of await this.modules.listOfBots(botIds)) {
      modulesByBot.set(module.botId, [...(modulesByBot.get(module.botId) ?? []), module])
    }
    const itemsById = new Map((await this.items.listByIds(itemIds)).map((item) => [item.id, item]))

    return sightings.map((sighting) => {
      const cell: IMapCell = {
        x: sighting.location.x,
        y: sighting.location.y,
        type: sighting.type,
        contentId: sighting.contentId,
        seenAt: sighting.seenAt
      }

      if (sighting.resource) {
        cell.resource = sighting.resource
        cell.capacity = this.resources[sighting.resource.resource].maxAmount
      }
      if (BODY_TYPES.has(sighting.type)) {
        cell.isOwn = own.has(sighting.contentId as string)
      }
      if (sighting.type === MapPointType.BOT) {
        const modules = modulesByBot.get(sighting.contentId as string) ?? []
        cell.chassis = chassisOf(modules)
        cell.icons = iconsOf(modules)
        cell.isDamaged = isDamaged(modules)
      }
      if (sighting.type === MapPointType.ITEM) {
        const item = itemsById.get(sighting.contentId as string)
        cell.item = item ? ITEM_KINDS[item.type] : 'generic'
      }

      return cell
    })
  }

  private async ownIds(userId: string): Promise<Set<string>> {
    return new Set((await this.bots.listOfUser(userId)).map((bot) => bot.id))
  }

  private validate({ minX, minY, maxX, maxY }: IMapRange) {
    const isValid =
      [minX, minY, maxX, maxY].every(Number.isInteger) &&
      minX <= maxX &&
      minY <= maxY &&
      maxX - minX < MAP_VIEW_MAX_SIDE &&
      maxY - minY < MAP_VIEW_MAX_SIDE

    if (!isValid) {
      throw new ValidationError('Invalid map range')
    }
  }
}
