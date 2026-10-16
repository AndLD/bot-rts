import { GatewayProbe, MetricReading, MetricSource } from '../application/ports'

// Whether the log gateway is up and how full its export queue is; a queue that cannot be read is left out
export class GatewayMetricSource implements MetricSource {
  constructor(private readonly gateway: GatewayProbe) {}

  async read(): Promise<MetricReading> {
    const { isUp, queueSize } = await this.gateway.read()
    const values: Record<string, number> = { 'infrastructure.gatewayUp': isUp ? 1 : 0 }

    if (queueSize !== null) {
      values['infrastructure.gatewayQueueSize'] = queueSize
    }

    return { values }
  }
}
