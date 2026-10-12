import { Heading } from '../../../../../lib/utils/interfaces/map'
import { RESOURCE } from '../../../../../lib/utils/interfaces/resources'
import { Item } from '../../../crafting/domain/item.entity'
import { Location, LocationRange, MapPoint } from '../../../map/domain/map-point.entity'
import { BotState } from '../../domain/bot-state'

// A bot as stored: what it is made of, where it stands and what it carries
export interface StoredBot {
  state: BotState
  position: Location | null
  heading: Heading
  carried: Item[]
}

// A cell nobody has touched yet, rolled by the world generator
export interface NewCell {
  point: MapPoint
  item: Item | null
}

// Where the engine's in-memory world comes from (design §12.2.2: the engine loads the map in chunks on demand)
export interface WorldSource {
  loadBot(botId: string): Promise<StoredBot | null>
  // The stored cells of a range with the items lying on them
  loadCells(range: LocationRange): Promise<{ points: MapPoint[]; items: Item[] }>
  // Rolls the content of a cell that does not exist yet
  generate(location: Location): NewCell
  // How hard a resource is to mine (design §9.1)
  hardnessOf(resource: RESOURCE): number
}
