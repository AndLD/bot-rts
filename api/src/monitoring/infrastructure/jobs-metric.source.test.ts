import { FakeClock } from '../../../tests/fakes/fakes'
import { IJobStatus } from '../../../../lib/utils/admin-operations'
import { JobsMetricSource } from './jobs-metric.source'

function setup(jobs: IJobStatus[], queue = { waiting: 0, oldestWaitMs: null as number | null }) {
  const clock = new FakeClock()
  const state = { jobs, queue }
  const source = new JobsMetricSource(
    { record: async () => undefined, list: async () => state.jobs },
    { notificationQueue: async () => state.queue },
    clock
  )

  return { source, state, clock }
}

const lifecycle = (overrides: Partial<IJobStatus> = {}): IJobStatus => ({
  name: 'lifecycle',
  lastRunAt: new FakeClock().now().getTime() - 90_000,
  failures: 2,
  totals: {},
  lastPass: { durationMs: 340 },
  ...overrides
})

describe('JobsMetricSource', () => {
  it('reports how long ago the job ran and how long its pass took, and the failures from the second reading on', async () => {
    const { source, state } = setup([lifecycle()])

    const first = await source.read()
    state.jobs = [lifecycle({ failures: 5 })]
    const second = await source.read()

    expect(first.values).toMatchObject({ 'jobs.lifecycleAgeSeconds': 90, 'jobs.lifecycleDurationMs': 340 })
    expect(first.values).not.toHaveProperty('jobs.lifecycleFailures')
    expect(second.values['jobs.lifecycleFailures']).toBe(3)
  })

  it('has nothing about a job that has not run, or whose pass did not report its duration', async () => {
    const { values } = await setup([lifecycle({ lastRunAt: null, lastPass: undefined })]).source.read()

    expect(values).not.toHaveProperty('jobs.lifecycleAgeSeconds')
    expect(values).not.toHaveProperty('jobs.lifecycleDurationMs')
  })

  it('has nothing about the job when no status was stored, and never a negative age or failure count', async () => {
    const { source, state } = setup([])
    expect((await source.read()).values).not.toHaveProperty('jobs.lifecycleAgeSeconds')

    state.jobs = [lifecycle({ lastRunAt: new FakeClock().now().getTime() + 5000, failures: 4 })]
    await source.read()
    state.jobs = [lifecycle({ lastRunAt: new FakeClock().now().getTime() + 5000, failures: 1 })]
    const { values } = await source.read()

    expect(values['jobs.lifecycleAgeSeconds']).toBe(0)
    expect(values['jobs.lifecycleFailures']).toBe(0)
  })

  it('reports the notifications waiting and how long the oldest has waited', async () => {
    const waiting = await setup([], { waiting: 7, oldestWaitMs: 4200 }).source.read()
    const none = await setup([]).source.read()

    expect(waiting.values).toMatchObject({ 'notifications.queueDepth': 7, 'notifications.deliveryLagMs': 4200 })
    expect(none.values).toMatchObject({ 'notifications.queueDepth': 0, 'notifications.deliveryLagMs': 0 })
  })
})
