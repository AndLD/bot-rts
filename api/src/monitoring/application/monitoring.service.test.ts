import { FakeClock, SequentialIdGenerator } from '../../../tests/fakes/fakes'
import { NotFoundError, ValidationError } from '../../shared/domain/errors'
import { Alert } from '../domain/alert'
import { AlertManager } from './alert-manager'
import { MetricHistory } from './metric-history'
import { MonitoringService } from './monitoring.service'
import { AlertNotifier, MetricSample, MetricsPort } from './ports'

class ScriptedPort implements MetricsPort {
  next: MetricSample | Error = { at: new Date('2026-06-01T12:00:00.000Z'), values: {} }
  async sample() {
    if (this.next instanceof Error) throw this.next
    return this.next
  }
}

class RecordingNotifier implements AlertNotifier {
  sent: Alert[] = []
  fails = false
  async notify(alert: Alert) {
    if (this.fails) throw new Error('smtp down')
    this.sent.push(alert)
  }
}

function setup(thresholds = {}) {
  const port = new ScriptedPort()
  const notifier = new RecordingNotifier()
  const clock = new FakeClock()
  const logger = { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() }
  const alerts = new AlertManager(thresholds, notifier, new SequentialIdGenerator(), clock)
  const history = new MetricHistory([{ stepMs: 10_000, retentionMs: 3_600_000 }])
  const service = new MonitoringService(port, history, alerts, clock, logger as never)
  const sample = (values: Record<string, number>) => {
    port.next = { at: clock.now(), values }
    return service.sampleOnce()
  }

  return { port, notifier, clock, logger, service, sample }
}

describe('MonitoringService health', () => {
  it('is green with no values before the first sample', () => {
    const { service } = setup()
    const health = service.health()

    expect(health.sampledAt).toBeNull()
    expect(health.status).toBe('green')
    expect(health.areas.map((area) => area.area)).toEqual(['engine', 'scripts', 'api', 'infrastructure'])
    expect(health.areas[0].metrics.every((metric) => metric.value === null)).toBe(true)
  })

  it('colours a metric, its area and the whole by the worst threshold crossed', async () => {
    const { service, sample } = setup()
    await sample({ 'engine.up': 1, 'engine.tickP95Ratio': 0.9, 'api.errorRate5xx': 0.5, 'api.latencyP95Ms': 100 })
    const health = service.health()
    const status = (area: string) => health.areas.find((candidate) => candidate.area === area)?.status

    expect(health.sampledAt).toEqual(new Date('2026-06-01T12:00:00.000Z'))
    expect(status('engine')).toBe('yellow')
    expect(status('api')).toBe('red')
    expect(status('scripts')).toBe('green')
    expect(health.status).toBe('red')
    expect(health.alerts.map((alert) => alert.metric).sort()).toEqual(['api.errorRate5xx', 'engine.tickP95Ratio'])
  })

  it('takes the thresholds from the configuration', async () => {
    const { service, sample } = setup({ 'api.errorRate5xx': { yellow: 0.5, red: 0.9 } })
    await sample({ 'api.errorRate5xx': 0.4 })

    expect(service.health().status).toBe('green')
  })
})

describe('MonitoringService sampling', () => {
  it('records a history that the series reads', async () => {
    const { service, sample } = setup()
    await sample({ 'engine.up': 1, 'engine.lastTickMs': 12 })

    expect(service.series('engine.lastTickMs', '1h')).toEqual({
      metric: 'engine.lastTickMs',
      stepMs: 10_000,
      points: [[new FakeClock().now().getTime(), 12]]
    })
  })

  it('refuses an unknown metric or range', () => {
    const { service } = setup()

    expect(() => service.series('nope', '1h')).toThrow(ValidationError)
    expect(() => service.series('engine.up', '2h' as never)).toThrow(ValidationError)
  })

  it('logs a failed sample and keeps going', async () => {
    const { port, service, logger, sample } = setup()
    port.next = new Error('boom')
    await service.sampleOnce()

    expect(logger.error).toHaveBeenCalled()
    await sample({ 'engine.up': 1 })
    expect(service.health().sampledAt).not.toBeNull()
  })
})

describe('alerts', () => {
  it('opens once, emails a red one, escalates, and closes when the metric recovers', async () => {
    const { service, notifier, clock, sample } = setup()
    await sample({ 'api.errorRate5xx': 0.02 })
    await sample({ 'api.errorRate5xx': 0.03 })
    expect(service.listAlerts()).toHaveLength(1)
    expect(service.listAlerts()[0]).toMatchObject({ severity: 'yellow', value: 0.03 })
    expect(notifier.sent).toHaveLength(0)

    await sample({ 'api.errorRate5xx': 0.2 })
    expect(notifier.sent.map((alert) => alert.severity)).toEqual(['red'])
    expect(service.health().alerts).toHaveLength(1)

    clock.current = new Date('2026-06-01T12:10:00.000Z')
    await sample({ 'api.errorRate5xx': 0 })
    expect(service.health().alerts).toEqual([])
    const [closed] = service.listAlerts()
    expect(closed).toMatchObject({ severity: 'red', clearedAt: clock.current })
    // the yellow alert it replaced is listed as cleared too
    expect(service.listAlerts()).toHaveLength(2)
  })

  it('still raises the alert when the email cannot be sent, and skips metrics that were not sampled', async () => {
    const { service, notifier, sample } = setup()
    notifier.fails = true
    await sample({ 'engine.up': 0 })

    expect(service.health().alerts[0]).toMatchObject({ metric: 'engine.up', severity: 'red', area: 'engine' })
    await sample({})
    expect(service.health().alerts).toHaveLength(1)
  })

  it('acknowledges an open alert and refuses an unknown one', async () => {
    const { service, sample } = setup()
    await sample({ 'engine.up': 0 })
    const [alert] = service.health().alerts

    const acknowledged = service.acknowledge(alert.id, 'admin-1')
    expect(acknowledged).toMatchObject({ acknowledgedBy: 'admin-1', acknowledgedAt: new FakeClock().now() })
    expect(service.health().alerts[0].acknowledgedBy).toBe('admin-1')
    expect(() => service.acknowledge('missing', 'admin-1')).toThrow(NotFoundError)
  })
})
