import { PrometheusText } from './prometheus'

// Seconds; from a cached read to a slow engine round trip
const BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30]

interface Series {
  count: number
  sumSeconds: number
  buckets: number[]
}

// Totals since the process started, enough to work out rates and a percentile between two readings
export interface HttpTotals {
  count: number
  errors5xx: number
  errors4xx: number
  // Cumulative request counts per latency bound, with the bound in seconds
  buckets: Array<{ le: number; count: number }>
}

export interface HttpObservation {
  method: string
  route: string
  status: number
  durationMs: number
}

// Request counts and a latency histogram per method, route pattern and status class
export class HttpMetrics {
  private readonly series = new Map<string, Series & { method: string; route: string; statusClass: string }>()

  observe({ method, route, status, durationMs }: HttpObservation): void {
    const statusClass = `${Math.floor(status / 100)}xx`
    const key = `${method} ${route} ${statusClass}`
    const series = this.series.get(key) ?? {
      method,
      route,
      statusClass,
      count: 0,
      sumSeconds: 0,
      buckets: BUCKETS.map(() => 0)
    }
    const seconds = durationMs / 1000

    series.count += 1
    series.sumSeconds += seconds
    BUCKETS.forEach((bound, index) => {
      if (seconds <= bound) {
        series.buckets[index] += 1
      }
    })
    this.series.set(key, series)
  }

  totals(): HttpTotals {
    const totals: HttpTotals = {
      count: 0,
      errors5xx: 0,
      errors4xx: 0,
      buckets: BUCKETS.map((le) => ({ le, count: 0 }))
    }

    for (const series of this.series.values()) {
      totals.count += series.count
      totals.errors5xx += series.statusClass === '5xx' ? series.count : 0
      totals.errors4xx += series.statusClass === '4xx' ? series.count : 0
      series.buckets.forEach((count, index) => (totals.buckets[index].count += count))
    }

    return totals
  }

  render(text: PrometheusText): void {
    text.family('botrts_http_request_duration_seconds', 'histogram', 'API request latency by route pattern')
    for (const { method, route, statusClass, count, sumSeconds, buckets } of this.series.values()) {
      const labels = { method, route, status: statusClass }
      BUCKETS.forEach((bound, index) =>
        text.sample('botrts_http_request_duration_seconds_bucket', buckets[index], { ...labels, le: bound })
      )
      text.sample('botrts_http_request_duration_seconds_bucket', count, { ...labels, le: '+Inf' })
      text.sample('botrts_http_request_duration_seconds_sum', sumSeconds, labels)
      text.sample('botrts_http_request_duration_seconds_count', count, labels)
    }
  }
}
