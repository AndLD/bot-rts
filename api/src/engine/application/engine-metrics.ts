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
}

export interface TickSample {
  tick: number
  durationMs: number
  intervalMs: number
  isCut: boolean
  queuedExecutions: number
  deferredExecutions: number
  maxWaitTicks: number
}

export interface EngineMetricsSnapshot extends TickMetrics {
  executions: number
  // The heap of every sandbox together
  memoryBytes: number
}

const WINDOW = 100
const SLOW_TICKS_KEPT = 20

export class EngineMetrics {
  private readonly durations: number[] = []
  private slowTicks: SlowTick[] = []
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
      ...this.last
    }
  }
}
