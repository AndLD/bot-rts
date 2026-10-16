// The numbers the engine exports about itself (design §12.2.2): tick duration, executions, context memory
// A tick that took longer than the tick interval, kept for the console's slow-tick traces (design §25.3, Logs and audit)
export interface SlowTick {
  tick: number
  durationMs: number
  intervalMs: number
  // Whether the tick cap cut the work short
  isCut: boolean
  queuedExecutions: number
  deferredExecutions: number
}

// The slowest tick of a block of ticks, with the trace it ran in, for following a slow stretch of the charts to its cause
export interface SlowestTick {
  tick: number
  durationMs: number
  traceId: string | null
}

export interface TickMetrics {
  tick: number
  lastTickMs: number
  p95TickMs: number
  // Ticks whose work ran past the tick interval, or was cut at the cap, since the engine started
  overrunTicks: number
  cutTicks: number
  // Scheduler (design §12.2): executions above their bot's parallel limit, waiting in the queue, in the last tick
  queuedExecutions: number
  // Executions the tick cap kept from running in the last tick
  deferredExecutions: number
  // Fairness: the most ticks in a row any live execution has gone without being stepped (0 when all were served)
  maxWaitTicks: number
  // The newest slow ticks, oldest first
  slowTicks: SlowTick[]
  // How many ticks took each duration since the engine started, one count per bound of `TICK_BOUNDS_MS` and one above the last
  tickBuckets: number[]
  // The slowest tick of each of the newest blocks of ticks, oldest first
  slowestTicks: SlowestTick[]
}

export interface TickSample {
  tick: number
  durationMs: number
  intervalMs: number
  isCut: boolean
  queuedExecutions: number
  deferredExecutions: number
  maxWaitTicks: number
  // The trace the tick ran in, if tracing is on
  traceId?: string | null
}

export interface EngineMetricsSnapshot extends TickMetrics {
  executions: number
  // The heap of every sandbox together
  memoryBytes: number
  // How long the engine has been running (ms, from the monotonic clock)
  uptimeMs: number
}

const WINDOW = 100
const SLOW_TICKS_KEPT = 20
// Upper bounds of the tick duration histogram in ms (the console's `engine.tickMs`, see monitoring/domain/histograms.ts)
export const TICK_BOUNDS_MS = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000]
// A block is about the sampling interval of the console at the default tick rate
const BLOCK_TICKS = 100
const BLOCKS_KEPT = 12

export class EngineMetrics {
  private readonly durations: number[] = []
  private slowTicks: SlowTick[] = []
  private readonly buckets: number[] = TICK_BOUNDS_MS.map(() => 0).concat(0)
  private blocks: SlowestTick[] = []
  private tick = 0
  private overrunTicks = 0
  private cutTicks = 0
  private last = { queuedExecutions: 0, deferredExecutions: 0, maxWaitTicks: 0 }

  record(sample: TickSample): void {
    this.tick = sample.tick
    this.last = {
      queuedExecutions: sample.queuedExecutions,
      deferredExecutions: sample.deferredExecutions,
      maxWaitTicks: sample.maxWaitTicks
    }
    this.countBucket(sample.durationMs)
    this.keepSlowest(sample)
    this.durations.push(sample.durationMs)
    if (this.durations.length > WINDOW) {
      this.durations.shift()
    }
    if (sample.durationMs > sample.intervalMs) {
      this.overrunTicks += 1
      this.slowTicks = [
        ...this.slowTicks,
        {
          tick: sample.tick,
          durationMs: sample.durationMs,
          intervalMs: sample.intervalMs,
          isCut: sample.isCut,
          queuedExecutions: sample.queuedExecutions,
          deferredExecutions: sample.deferredExecutions
        }
      ].slice(-SLOW_TICKS_KEPT)
    }
    if (sample.isCut) {
      this.cutTicks += 1
    }
  }

  snapshot(): TickMetrics {
    const sorted = [...this.durations].sort((a, b) => a - b)
    return {
      tick: this.tick,
      lastTickMs: this.durations[this.durations.length - 1] ?? 0,
      p95TickMs: sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] ?? 0,
      overrunTicks: this.overrunTicks,
      cutTicks: this.cutTicks,
      slowTicks: [...this.slowTicks],
      tickBuckets: [...this.buckets],
      slowestTicks: this.blocks.map((block) => ({ ...block })),
      ...this.last
    }
  }

  private countBucket(durationMs: number): void {
    const index = TICK_BOUNDS_MS.findIndex((bound) => durationMs <= bound)
    this.buckets[index === -1 ? TICK_BOUNDS_MS.length : index] += 1
  }

  // The slowest tick of the block this tick is in; a new block starts every BLOCK_TICKS ticks
  private keepSlowest({ tick, durationMs, traceId }: TickSample): void {
    const current = this.blocks[this.blocks.length - 1]
    const isSameBlock = current && Math.floor((current.tick - 1) / BLOCK_TICKS) === Math.floor((tick - 1) / BLOCK_TICKS)

    if (!isSameBlock) {
      this.blocks = [...this.blocks, { tick, durationMs, traceId: traceId ?? null }].slice(-BLOCKS_KEPT)
    } else if (durationMs > current.durationMs) {
      this.blocks[this.blocks.length - 1] = { tick, durationMs, traceId: traceId ?? null }
    }
  }
}
