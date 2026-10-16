import { Heading } from '../../../../lib/utils/interfaces/map'
import { Item } from '../../crafting/domain/item.entity'
import { KnownPoint, MapPoint } from '../../map/domain/map-point.entity'
import { Module } from '../../modules/domain/module.entity'
import { NO_TRACING, Tracing } from '../../shared/application/tracing'
import { ENGINE_GAUGE, MetricRecorder, NO_RECORDER } from './engine-metrics'
import { WorldStateBatch, WorldStateStore } from '../../persistence/application/world-state-store'

// Collects what the engine changed and writes it in one batch every `everyTicks` ticks (design §12.3.1, §14.2): the world
// lives in memory and the database follows. Only the newest value of an entity is kept, so a cell that changes every
// tick costs one row per flush.
export class WriteBehind {
  private modules = new Map<string, Module>()
  private mapPoints = new Map<string, MapPoint>()
  private knownPoints = new Map<string, KnownPoint>()
  private items = new Map<string, Item>()
  private removedItems = new Set<string>()
  private headings = new Map<string, Heading>()
  private lastFlushTick = 0

  private failures = 0
  private readonly discardListeners: Array<() => void> = []

  constructor(
    private readonly store: WorldStateStore,
    private readonly everyTicks: number,
    // A batch that fails this many times in a row is dropped, so that one bad row (a bot deleted behind the engine's back, say)
    // cannot keep every later write from reaching the database
    private readonly maxFailures: number,
    private readonly tracing: Tracing = NO_TRACING,
    // Tells how long the last write took and how many rows it held
    private readonly recorder: MetricRecorder = NO_RECORDER,
    private readonly nowMs: () => number = () => performance.now()
  ) {}

  // How many ticks the world has gone without a write
  ticksSinceFlush(tick: number): number {
    return tick - this.lastFlushTick
  }

  // Told when a batch is given up on; what the engine holds in memory can no longer be trusted
  onDiscard(listener: () => void): void {
    this.discardListeners.push(listener)
  }

  stageModule(module: Module): void {
    this.modules.set(module.id, module)
  }

  stageMapPoint(point: MapPoint): void {
    this.mapPoints.set(point.id, point)
  }

  stageKnownPoint(point: KnownPoint): void {
    this.knownPoints.set(point.id, point)
  }

  stageItem(item: Item): void {
    this.items.set(item.id, item)
  }

  // An item that no longer exists (used up)
  stageItemRemoval(itemId: string): void {
    this.items.delete(itemId)
    this.removedItems.add(itemId)
  }

  stageHeading(botId: string, heading: Heading): void {
    this.headings.set(botId, heading)
  }

  get pending(): number {
    return (
      this.modules.size +
      this.mapPoints.size +
      this.knownPoints.size +
      this.items.size +
      this.headings.size +
      this.removedItems.size
    )
  }

  // Flushes when the interval since the last flush has passed; returns whether it did
  async flushIfDue(tick: number): Promise<boolean> {
    if (tick - this.lastFlushTick < this.everyTicks) {
      return false
    }
    await this.flush(tick)
    return true
  }

  // Writes everything staged. When the write fails the batch is kept for the next try, newer values winning, until it has failed
  // `maxFailures` times in a row.
  async flush(tick: number): Promise<void> {
    this.lastFlushTick = tick
    if (!this.pending) {
      return
    }
    const batch: WorldStateBatch = {
      modules: [...this.modules.values()],
      mapPoints: [...this.mapPoints.values()],
      knownPoints: [...this.knownPoints.values()],
      items: [...this.items.values()],
      removedItemIds: [...this.removedItems],
      headings: [...this.headings].map(([botId, heading]) => ({ botId, heading }))
    }
    this.modules = new Map()
    this.mapPoints = new Map()
    this.knownPoints = new Map()
    this.items = new Map()
    this.removedItems = new Set()
    this.headings = new Map()
    const startedAt = this.nowMs()
    this.recorder.gauge(ENGINE_GAUGE.flushPending, this.rowsOf(batch))
    try {
      await this.tracing.withSpan('engine.world-flush', { attributes: { 'botrts.rows': this.rowsOf(batch) } }, () =>
        this.store.flush(batch)
      )
      this.failures = 0
      this.recorder.gauge(ENGINE_GAUGE.flushMs, this.nowMs() - startedAt)
    } catch (error) {
      this.failures += 1
      if (this.failures >= this.maxFailures) {
        this.failures = 0
        this.discardListeners.forEach((listener) => listener())
      } else {
        this.restore(batch)
      }
      throw error
    }
  }

  private rowsOf(batch: WorldStateBatch): number {
    return (
      batch.modules.length +
      batch.mapPoints.length +
      batch.knownPoints.length +
      batch.items.length +
      batch.removedItemIds.length +
      batch.headings.length
    )
  }

  // The failed batch goes back below whatever was staged meanwhile
  private restore(batch: WorldStateBatch): void {
    this.modules = new Map([...batch.modules.map((m): [string, Module] => [m.id, m]), ...this.modules])
    this.mapPoints = new Map([...batch.mapPoints.map((p): [string, MapPoint] => [p.id, p]), ...this.mapPoints])
    this.knownPoints = new Map([...batch.knownPoints.map((p): [string, KnownPoint] => [p.id, p]), ...this.knownPoints])
    this.items = new Map([...batch.items.map((i): [string, Item] => [i.id, i]), ...this.items])
    this.removedItems = new Set([...batch.removedItemIds, ...this.removedItems])
    this.headings = new Map([...batch.headings.map((h): [string, Heading] => [h.botId, h.heading]), ...this.headings])
  }
}
