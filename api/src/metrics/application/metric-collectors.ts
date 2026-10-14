import { PrometheusText } from './prometheus'

export type MetricCollector = (text: PrometheusText) => void

// Where other features add their own series to the metrics endpoint without the metrics feature knowing them
export class MetricCollectors {
  private readonly collectors: MetricCollector[] = []

  register(collector: MetricCollector): void {
    this.collectors.push(collector)
  }

  render(text: PrometheusText): void {
    this.collectors.forEach((collect) => collect(text))
  }
}
