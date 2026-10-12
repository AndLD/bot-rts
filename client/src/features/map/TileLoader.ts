import { IMapRange, IMapView } from '@lib/utils/interfaces/map'
import { MapStore } from './MapStore'

// Cells per side of the squares the map is asked for in; it must stay below MAP_VIEW_MAX_SIDE, the server's limit
export const TILE_SIDE = 32
// The tiles asked for in one go, so a far zoom-out cannot flood the server
const MAX_TILES_PER_CALL = 24

const tileKey = (tx: number, ty: number) => `${tx},${ty}`

export type MapRequest = (range: IMapRange) => Promise<IMapView>

// Asks the server for the parts of the map that are on screen and have not been asked for yet (fog of war is applied by
// the server: unknown cells are simply not in the answer). Knowledge that grows elsewhere (a scan) is picked up after
// `invalidate`.
export class TileLoader {
  private readonly loaded = new Set<string>()
  private readonly inFlight = new Set<string>()
  private generation = 0
  private readonly listeners = new Set<() => void>()

  constructor(
    private readonly request: MapRequest,
    private readonly store: MapStore
  ) {}

  // Loads what is missing in the range of cells
  ensure(range: IMapRange): Promise<void> {
    const wanted: Array<[number, number]> = []

    for (let ty = Math.floor(range.minY / TILE_SIDE); ty <= Math.floor(range.maxY / TILE_SIDE); ty++) {
      for (let tx = Math.floor(range.minX / TILE_SIDE); tx <= Math.floor(range.maxX / TILE_SIDE); tx++) {
        const key = tileKey(tx, ty)
        if (!this.loaded.has(key) && !this.inFlight.has(key) && wanted.length < MAX_TILES_PER_CALL) {
          wanted.push([tx, ty])
        }
      }
    }

    return Promise.all(wanted.map(([tx, ty]) => this.fetch(tx, ty))).then(() => undefined)
  }

  // What is known may have grown: everything is asked for again the next time it is on screen
  invalidate() {
    this.generation += 1
    this.loaded.clear()
    this.inFlight.clear()
    for (const listener of this.listeners) {
      listener()
    }
  }

  // Told when tiles must be asked for again, so the owner can ask for the ones on screen
  onInvalidate(listener: () => void): () => void {
    this.listeners.add(listener)

    return () => this.listeners.delete(listener)
  }

  private async fetch(tx: number, ty: number) {
    const key = tileKey(tx, ty)
    const generation = this.generation
    this.inFlight.add(key)

    try {
      const view = await this.request({
        minX: tx * TILE_SIDE,
        minY: ty * TILE_SIDE,
        maxX: (tx + 1) * TILE_SIDE - 1,
        maxY: (ty + 1) * TILE_SIDE - 1
      })

      if (generation === this.generation) {
        this.store.load(view)
        this.loaded.add(key)
      }
    } catch {
      // The tile is asked for again the next time it is on screen
    } finally {
      if (generation === this.generation) {
        this.inFlight.delete(key)
      }
    }
  }
}
