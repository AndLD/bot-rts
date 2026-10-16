import { Clock } from '../../shared/application/clock'
import { JobStatusStore } from '../../operations/application/ports'
import { JobStatsRepository } from '../application/job-stats.repository'
import { MetricReading, MetricSource } from '../application/ports'

const LIFECYCLE = 'lifecycle'

// The background jobs and the notifications (design §25.5): how long ago the data lifecycle job last ran, how long the pass took, how
// many steps failed since the last reading, and the notifications waiting for delivery. The job's last report is in the database,
// written by the node that runs it, so any node can read it. A job that has not run yet has no age.
export class JobsMetricSource implements MetricSource {
  private previousFailures: number | null = null

  constructor(
    private readonly jobs: JobStatusStore,
    private readonly repository: JobStatsRepository,
    private readonly clock: Clock
  ) {}

  async read(): Promise<MetricReading> {
    const values: Record<string, number> = {}
    const lifecycle = (await this.jobs.list()).find((job) => job.name === LIFECYCLE)

    if (lifecycle) {
      if (lifecycle.lastRunAt !== null) {
        values['jobs.lifecycleAgeSeconds'] = Math.max(0, (this.clock.now().getTime() - lifecycle.lastRunAt) / 1000)
      }
      if (lifecycle.lastPass?.durationMs !== undefined) {
        values['jobs.lifecycleDurationMs'] = lifecycle.lastPass.durationMs
      }
      if (this.previousFailures !== null) {
        values['jobs.lifecycleFailures'] = Math.max(0, lifecycle.failures - this.previousFailures)
      }
      this.previousFailures = lifecycle.failures
    }
    const queue = await this.repository.notificationQueue()
    values['notifications.queueDepth'] = queue.waiting
    values['notifications.deliveryLagMs'] = queue.oldestWaitMs ?? 0

    return { values }
  }
}
