import { KnownPoint, MapPoint } from '../../map/domain/map-point.entity'
import { Module } from '../../modules/domain/module.entity'
import { WorldStateBatch, WorldStateStore } from '../../persistence/application/world-state-store'

// Collects what the engine changed and writes it in one batch every `everyTicks` ticks (design §12.3.1, §14.2): the world
// lives in memory and the database follows. Only the newest value of an entity is kept, so a cell that changes every
// tick costs one row per flush.
export class WriteBehind {
  private modules = new Map<string, Module>()
  private mapPoints = new Map<string, MapPoint>()
  private knownPoints = new Map<string, KnownPoint>()
  private lastFlushTick = 0

  constructor(
    private readonly store: WorldStateStore,
    private readonly everyTicks: number
  ) {}

  stageModule(module: Module): void {
    this.modules.set(module.id, module)
  }

  stageMapPoint(point: MapPoint): void {
    this.mapPoints.set(point.id, point)
  }

  stageKnownPoint(point: KnownPoint): void {
    this.knownPoints.set(point.id, point)
  }

  get pending(): number {
    return this.modules.size + this.mapPoints.size + this.knownPoints.size
  }

  // Flushes when the interval since the last flush has passed; returns whether it did
  async flushIfDue(tick: number): Promise<boolean> {
    if (tick - this.lastFlushTick < this.everyTicks) {
      return false
    }
    await this.flush(tick)
    return true
  }

  // Writes everything staged. When the write fails the batch is kept for the next try, newer values winning.
  async flush(tick: number): Promise<void> {
    this.lastFlushTick = tick
    if (!this.pending) {
      return
    }
    const batch: WorldStateBatch = {
      modules: [...this.modules.values()],
      mapPoints: [...this.mapPoints.values()],
      knownPoints: [...this.knownPoints.values()]
    }
    this.modules = new Map()
    this.mapPoints = new Map()
    this.knownPoints = new Map()
    try {
      await this.store.flush(batch)
    } catch (error) {
      this.restore(batch)
      throw error
    }
  }

  // The failed batch goes back below whatever was staged meanwhile
  private restore(batch: WorldStateBatch): void {
    this.modules = new Map([...batch.modules.map((m): [string, Module] => [m.id, m]), ...this.modules])
    this.mapPoints = new Map([...batch.mapPoints.map((p): [string, MapPoint] => [p.id, p]), ...this.mapPoints])
    this.knownPoints = new Map([...batch.knownPoints.map((p): [string, KnownPoint] => [p.id, p]), ...this.knownPoints])
  }
}
