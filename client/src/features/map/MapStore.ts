import { ILiveArea, IMapCell, IMapUpdate, IMapView, IRadioChange } from '@lib/utils/interfaces/map'
import { BotLink, toMapCell } from './mapper'
import { cellKey, MapCell } from './renderer/model'

type Listener = () => void

// The map the player has on screen: the cells received so far, which areas are live, and what the radio said. It is not in
// Redux because batches of cells arrive many times a second and only the canvas reads them. The renderer is told through
// `subscribe`.
export class MapStore {
  private raw = new Map<string, IMapCell>()
  private areas: ILiveArea[] = []
  private links = new Map<string, BotLink>()
  private cells = new Map<string, MapCell>()
  private listeners = new Set<Listener>()
  // Server time minus local time, so ages are counted in the server's clock
  private offset = 0

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)

    return () => this.listeners.delete(listener)
  }

  // The current time of the game, in ms
  now(): number {
    return Date.now() + this.offset
  }

  getCells(): ReadonlyMap<string, MapCell> {
    return this.cells
  }

  getCell(x: number, y: number): MapCell | undefined {
    return this.cells.get(cellKey(x, y))
  }

  getLiveAreas(): readonly ILiveArea[] {
    return this.areas
  }

  // The answer to a map request: new cells over what is there, and the live areas as they are now
  load(view: IMapView) {
    this.syncClock(view.now)
    this.areas = view.liveAreas
    this.put(view.cells)
    this.refreshLive()
    this.notify()
  }

  apply(update: IMapUpdate) {
    this.syncClock(update.now)
    this.put(update.cells)
    this.notify()
  }

  setLiveAreas(areas: ILiveArea[]) {
    this.areas = areas
    this.refreshLive()
    this.notify()
  }

  setRadio(changes: IRadioChange[]) {
    for (const change of changes) {
      this.links.set(change.botId, {
        isConnected: change.isConnected,
        bars: change.bars,
        lostAt: change.isConnected ? undefined : (this.links.get(change.botId)?.lostAt ?? this.now())
      })
    }
    const changed = new Set(changes.map((change) => change.botId))
    for (const [key, cell] of this.raw) {
      if (cell.contentId && changed.has(cell.contentId)) {
        this.cells.set(key, this.convert(cell))
      }
    }
    this.notify()
  }

  clear() {
    this.raw.clear()
    this.cells.clear()
    this.notify()
  }

  private put(cells: IMapCell[]) {
    for (const cell of cells) {
      const key = cellKey(cell.x, cell.y)
      this.raw.set(key, cell)
      this.cells.set(key, this.convert(cell))
    }
  }

  private convert(cell: IMapCell): MapCell {
    return toMapCell(cell, this.areas, cell.contentId ? this.links.get(cell.contentId) : undefined)
  }

  private refreshLive() {
    for (const [key, cell] of this.raw) {
      this.cells.set(key, this.convert(cell))
    }
  }

  private syncClock(serverNow: number) {
    this.offset = serverNow - Date.now()
  }

  private notify() {
    for (const listener of this.listeners) {
      listener()
    }
  }
}
