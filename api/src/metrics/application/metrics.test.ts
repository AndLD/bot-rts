import { EnginePort } from '../../engine/application/engine-port'
import { EngineMetricsSnapshot } from '../../engine/application/engine-metrics'
import { HttpMetrics } from './http-metrics'
import { MetricsService } from './metrics.service'
import { PrometheusText } from './prometheus'

const snapshot: EngineMetricsSnapshot = {
  tick: 42,
  lastTickMs: 3,
  p95TickMs: 7,
  overrunTicks: 1,
  cutTicks: 2,
  queuedExecutions: 4,
  deferredExecutions: 5,
  maxWaitTicks: 6,
  executions: 9,
  memoryBytes: 1024,
  uptimeMs: 5000,
  slowTicks: [],
  tickBuckets: [],
  slowestTicks: []
}
const stats = () => ({ uptimeSeconds: 12, rssBytes: 100, heapUsedBytes: 50 })
const engine = (metrics: () => Promise<EngineMetricsSnapshot>) => ({ metrics }) as unknown as EnginePort

describe('PrometheusText', () => {
  it('writes families and samples, escaping label values', () => {
    const text = new PrometheusText().family('x_total', 'counter', 'Things').sample('x_total', 3, { path: 'a"b\\c\nd' })

    expect(text.toString()).toBe('# HELP x_total Things\n# TYPE x_total counter\nx_total{path="a\\"b\\\\c\\nd"} 3\n')
    expect(new PrometheusText().sample('plain', 1).toString()).toBe('plain 1\n')
  })
})

describe('HttpMetrics slowest request', () => {
  it('keeps the slowest request with its trace until it is taken, and starts over', () => {
    const http = new HttpMetrics()
    expect(http.takeSlowest()).toBeNull()

    http.observe({ method: 'GET', route: '/a', status: 200, durationMs: 20, traceId: 't1' })
    http.observe({ method: 'GET', route: '/a', status: 200, durationMs: 90 })
    http.observe({ method: 'GET', route: '/a', status: 200, durationMs: 50, traceId: 't3' })

    expect(http.takeSlowest()).toEqual({ durationMs: 90, traceId: null })
    expect(http.takeSlowest()).toBeNull()
  })
})

describe('HttpMetrics', () => {
  it('counts requests per route and status class in a latency histogram', () => {
    const http = new HttpMetrics()
    http.observe({ method: 'GET', route: '/api/v1/time', status: 200, durationMs: 4 })
    http.observe({ method: 'GET', route: '/api/v1/time', status: 204, durationMs: 400 })
    http.observe({ method: 'GET', route: '/api/v1/time', status: 500, durationMs: 1 })
    const text = new PrometheusText()
    http.render(text)
    const out = text.toString()

    expect(out).toContain(
      'botrts_http_request_duration_seconds_count{method="GET",route="/api/v1/time",status="2xx"} 2'
    )
    expect(out).toContain(
      'botrts_http_request_duration_seconds_count{method="GET",route="/api/v1/time",status="5xx"} 1'
    )
    expect(out).toContain('status="2xx",le="0.005"} 1')
    expect(out).toContain('status="2xx",le="0.5"} 2')
    expect(out).toContain('status="2xx",le="+Inf"} 2')
    expect(out).toContain(
      'botrts_http_request_duration_seconds_sum{method="GET",route="/api/v1/time",status="2xx"} 0.404'
    )
  })
})

describe('MetricsService', () => {
  it('renders the engine numbers, the queue and fairness among them, and the process', async () => {
    const service = new MetricsService(
      new HttpMetrics(),
      engine(async () => snapshot),
      stats,
      'secret'
    )
    const out = await service.render()

    expect(out).toContain('botrts_engine_up 1')
    expect(out).toContain('botrts_engine_tick 42')
    expect(out).toContain('botrts_engine_tick_p95_milliseconds 7')
    expect(out).toContain('botrts_engine_queued_executions 4')
    expect(out).toContain('botrts_engine_max_wait_ticks 6')
    expect(out).toContain('botrts_process_uptime_seconds 12')
    expect(out).toContain('botrts_process_resident_memory_bytes 100')
    expect(out).toContain('botrts_process_heap_used_bytes 50')
  })

  it('reports a missing engine as down and leaves its numbers out', async () => {
    const service = new MetricsService(
      new HttpMetrics(),
      engine(() => Promise.reject(new Error('down'))),
      stats,
      'secret'
    )
    const out = await service.render()

    expect(out).toContain('botrts_engine_up 0')
    expect(out).not.toContain('botrts_engine_tick ')
  })

  it('answers 404 without a configured token, and 401 for a wrong one', () => {
    const none = new MetricsService(
      new HttpMetrics(),
      engine(async () => snapshot),
      stats,
      undefined
    )
    const guarded = new MetricsService(
      new HttpMetrics(),
      engine(async () => snapshot),
      stats,
      'secret'
    )

    expect(() => none.authorize('secret')).toThrow(expect.objectContaining({ statusCode: 404 }))
    expect(() => guarded.authorize(undefined)).toThrow(expect.objectContaining({ statusCode: 401 }))
    expect(() => guarded.authorize('wrong!')).toThrow(expect.objectContaining({ statusCode: 401 }))
    expect(() => guarded.authorize('secreX')).toThrow(expect.objectContaining({ statusCode: 401 }))
    expect(() => guarded.authorize('secret')).not.toThrow()
  })
})
