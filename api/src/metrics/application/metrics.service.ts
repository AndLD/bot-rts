import { timingSafeEqual } from 'crypto'
import { EnginePort } from '../../engine/application/engine-port'
import { EngineMetricsSnapshot } from '../../engine/application/engine-metrics'
import { UnauthorizedError, NotFoundError } from '../../shared/domain/errors'
import { HttpMetrics } from './http-metrics'
import { PrometheusText } from './prometheus'

export const METRICS_SERVICE = Symbol('MetricsService')

export interface ProcessStats {
  uptimeSeconds: number
  rssBytes: number
  heapUsedBytes: number
}

const ENGINE_GAUGES: Array<[keyof EngineMetricsSnapshot, string, string]> = [
  ['tick', 'botrts_engine_tick', 'Number of the last game tick'],
  ['lastTickMs', 'botrts_engine_last_tick_milliseconds', 'Duration of the last tick'],
  ['p95TickMs', 'botrts_engine_tick_p95_milliseconds', '95th percentile of the last hundred ticks'],
  ['overrunTicks', 'botrts_engine_overrun_ticks_total', 'Ticks that took longer than the tick interval'],
  ['cutTicks', 'botrts_engine_cut_ticks_total', 'Ticks cut at the tick cap'],
  ['executions', 'botrts_engine_executions', 'Live script executions'],
  [
    'queuedExecutions',
    'botrts_engine_queued_executions',
    'Executions waiting above their bot parallel limit (queue depth)'
  ],
  [
    'deferredExecutions',
    'botrts_engine_deferred_executions',
    'Executions the tick cap kept from running in the last tick'
  ],
  [
    'maxWaitTicks',
    'botrts_engine_max_wait_ticks',
    'Scheduler fairness: longest run of ticks an execution went unserved'
  ],
  ['memoryBytes', 'botrts_engine_sandbox_memory_bytes', 'Heap of all script sandboxes']
]

// Renders what the operator scrapes: API latency, the engine's tick and scheduler numbers, and the process itself
export class MetricsService {
  constructor(
    private readonly http: HttpMetrics,
    private readonly engine: EnginePort,
    private readonly stats: () => ProcessStats,
    // The bearer token that unlocks the endpoint; without one the endpoint does not exist
    private readonly token: string | undefined
  ) {}

  authorize(bearer: string | undefined): void {
    if (!this.token) {
      throw new NotFoundError()
    }
    const given = Buffer.from(bearer ?? '')
    const expected = Buffer.from(this.token)

    if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
      throw new UnauthorizedError('Metrics token is wrong')
    }
  }

  async render(): Promise<string> {
    const text = new PrometheusText()
    this.http.render(text)
    await this.renderEngine(text)
    const { uptimeSeconds, rssBytes, heapUsedBytes } = this.stats()
    text
      .family('botrts_process_uptime_seconds', 'gauge', 'Seconds since this API process started')
      .sample('botrts_process_uptime_seconds', uptimeSeconds)
      .family('botrts_process_resident_memory_bytes', 'gauge', 'Resident set size of this API process')
      .sample('botrts_process_resident_memory_bytes', rssBytes)
      .family('botrts_process_heap_used_bytes', 'gauge', 'Used V8 heap of this API process')
      .sample('botrts_process_heap_used_bytes', heapUsedBytes)

    return text.toString()
  }

  private async renderEngine(text: PrometheusText): Promise<void> {
    let snapshot: EngineMetricsSnapshot | undefined
    try {
      snapshot = await this.engine.metrics()
    } catch {
      snapshot = undefined
    }

    text
      .family('botrts_engine_up', 'gauge', '1 when the engine answers, 0 when it is down or switched off')
      .sample('botrts_engine_up', snapshot ? 1 : 0)
    if (!snapshot) {
      return
    }
    for (const [field, name, help] of ENGINE_GAUGES) {
      text.family(name, 'gauge', help).sample(name, snapshot[field])
    }
  }
}
