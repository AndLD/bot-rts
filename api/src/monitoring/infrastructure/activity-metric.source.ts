import { ApiActivitySnapshot } from '../../shared/application/api-activity'
import { MetricReading, MetricSource } from '../application/ports'

// The sockets and the rate limit of this node's API tier: the open ones as they are, the rest per sample from the second reading on
export class ActivityMetricSource implements MetricSource {
  private previous: ApiActivitySnapshot | null = null

  constructor(private readonly activity: { snapshot(): ApiActivitySnapshot }) {}

  async read(): Promise<MetricReading> {
    const current = this.activity.snapshot()
    const { previous } = this
    const values: Record<string, number> = {
      'api.socketConnections': current.socketsOpen,
      'world.onlinePlayers': current.onlinePlayers
    }

    if (previous) {
      values['api.socketConnects'] = current.socketConnects - previous.socketConnects
      values['api.socketReconnects'] = current.socketReconnects - previous.socketReconnects
      values['api.rateLimitHits'] = current.rateLimitHits - previous.rateLimitHits
      values['notifications.emailFailures'] = current.emailFailures - previous.emailFailures
    }
    this.previous = current

    return { values }
  }
}
