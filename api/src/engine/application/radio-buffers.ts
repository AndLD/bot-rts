import { KnownPoint } from '../../map/domain/map-point.entity'
import { locationKey } from '../../map/domain/location'
import { GameEvent } from '../domain/game-event'

export interface RadioBufferLimits {
  // The newest scanned cells and events a bot keeps while it is out of reach (design §11.2.1)
  scans: number
  events: number
}

export const DEFAULT_RADIO_BUFFER_LIMITS: RadioBufferLimits = { scans: 1000, events: 200 }

export interface BufferedContent {
  scans: KnownPoint[]
  events: GameEvent[]
}

// What a bot out of reach of its base remembers for the player until the link returns: the cells it scanned (with the time it saw
// them) and the events about it. When a buffer is full the oldest entries are dropped.
export class RadioBuffers {
  private readonly scans = new Map<string, Map<string, KnownPoint>>()
  private readonly events = new Map<string, GameEvent[]>()

  constructor(private readonly limits: RadioBufferLimits) {}

  // A cell seen again replaces the older sighting of the same cell
  keepScan(botId: string, point: KnownPoint): void {
    const cells = this.scans.get(botId) ?? new Map<string, KnownPoint>()
    const key = locationKey(point.location)
    cells.delete(key)
    cells.set(key, point)
    if (cells.size > this.limits.scans) {
      cells.delete(cells.keys().next().value as string)
    }
    this.scans.set(botId, cells)
  }

  keepEvent(botId: string, event: GameEvent): void {
    const kept = [...(this.events.get(botId) ?? []), event]
    this.events.set(botId, kept.slice(Math.max(kept.length - this.limits.events, 0)))
  }

  // Everything kept for the bot, which is forgotten
  take(botId: string): BufferedContent {
    const content = { scans: [...(this.scans.get(botId)?.values() ?? [])], events: this.events.get(botId) ?? [] }
    this.scans.delete(botId)
    this.events.delete(botId)
    return content
  }
}
