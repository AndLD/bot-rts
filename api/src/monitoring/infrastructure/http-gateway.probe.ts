import { GatewayProbe, GatewayReading } from '../application/ports'

type Fetch = (url: string, init: { signal: AbortSignal }) => Promise<{ ok: boolean; text(): Promise<string> }>

// The batches waiting in the gateway's export queues (logs and traces), summed from its Prometheus text
const QUEUE_SIZE = /^otelcol_exporter_queue_size\{[^}]*\}\s+([0-9.eE+-]+)\s*$/gm

// Asks the gateway collector how it is: its health-check extension answers 200 while it runs, and its own metrics tell how full the
// export queue is. A gateway that cannot be reached is down, and the console shows that instead of failing.
export class HttpGatewayProbe implements GatewayProbe {
  constructor(
    private readonly healthUrl: string | undefined,
    private readonly metricsUrl: string | undefined,
    private readonly timeoutMs: number,
    private readonly fetchImpl: Fetch = fetch
  ) {}

  async read(): Promise<GatewayReading> {
    const [isUp, queueSize] = await Promise.all([this.isUp(), this.queueSize()])

    return { isUp: isUp ?? queueSize !== null, queueSize }
  }

  // Undefined when there is no health address to ask
  private async isUp(): Promise<boolean | undefined> {
    if (!this.healthUrl) {
      return undefined
    }
    const response = await this.get(this.healthUrl)

    return response !== null
  }

  private async queueSize(): Promise<number | null> {
    const text = this.metricsUrl ? await this.get(this.metricsUrl) : null
    if (text === null) {
      return null
    }
    const sizes = [...text.matchAll(QUEUE_SIZE)].map((match) => Number(match[1]))

    return sizes.length > 0 ? sizes.reduce((sum, size) => sum + size, 0) : null
  }

  // The body of the answer, or null when there was none in time or it was not a success
  private async get(url: string): Promise<string | null> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)
    try {
      const response = await this.fetchImpl(url, { signal: controller.signal })

      return response.ok ? await response.text() : null
    } catch {
      return null
    } finally {
      clearTimeout(timer)
    }
  }
}
