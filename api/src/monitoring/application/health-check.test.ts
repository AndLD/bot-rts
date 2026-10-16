import { composeHealthCheck } from './health-check'
import { HealthView } from './monitoring.service'

const metric = (id: string, value: number | null, area: string) => ({
  id,
  area,
  unit: 'number',
  value,
  status: 'green'
})

const view = (overrides: Partial<HealthView> = {}, values: Record<string, number | null> = {}): HealthView =>
  ({
    sampledAt: new Date(5000),
    status: 'yellow',
    areas: [
      {
        area: 'engine',
        status: 'yellow',
        metrics: Object.entries(values).map(([id, value]) => metric(id, value, 'engine'))
      },
      { area: 'database', status: 'red', metrics: [] }
    ],
    alerts: [
      {
        id: 'a1',
        metric: 'engine.tickP95Ratio',
        area: 'engine',
        severity: 'yellow',
        value: 0.9,
        threshold: 0.8,
        openedAt: new Date(1000),
        clearedAt: null,
        acknowledgedAt: null,
        acknowledgedBy: null
      }
    ],
    ...overrides
  }) as unknown as HealthView

describe('composeHealthCheck', () => {
  it('gathers the tick, script, flush and store figures with the open alerts', () => {
    const check = composeHealthCheck(
      view(
        {},
        {
          'engine.tickP95Ms': 40,
          'engine.tickP95Ratio': 0.8,
          'engine.overrunRate': 0.01,
          'engine.cutTicks': 2,
          'engine.ticksSkipped': 1,
          'scripts.killedBySlice': 3,
          'engine.flushMs': 12,
          'engine.flushLagMs': 30,
          'engine.flushPending': 4,
          'infrastructure.gatewayUp': 1
        }
      )
    )

    expect(check).toMatchObject({
      sampledAt: 5000,
      status: 'yellow',
      tick: { p95Ms: 40, p95Ratio: 0.8, overrunRate: 0.01, cutTicks: 2, skippedTicks: 1 },
      scripts: { killedBySlice: 3 },
      flush: { lastMs: 12, lagMs: 30, pending: 4 },
      store: { databaseStatus: 'red', isLogGatewayUp: true }
    })
    expect(check.alerts).toEqual([expect.objectContaining({ _id: 'a1', openedAt: 1000, clearedAt: null })])
  })

  it('answers nulls before the first sample, and a gateway that is down', () => {
    const empty = composeHealthCheck(view({ sampledAt: null, areas: [], alerts: [] }))
    const down = composeHealthCheck(view({}, { 'infrastructure.gatewayUp': 0 }))

    expect(empty).toMatchObject({
      sampledAt: null,
      alerts: [],
      tick: { p95Ms: null },
      flush: { pending: null },
      store: { databaseStatus: 'green', isLogGatewayUp: null }
    })
    expect(down.store.isLogGatewayUp).toBe(false)
  })
})
