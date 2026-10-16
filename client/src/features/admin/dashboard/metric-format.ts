import type { IMetricHealth } from '@lib/utils/admin'

// A metric value as the dashboard shows it, by the unit of the metric
export function formatMetric(value: number | null, unit: IMetricHealth['unit']): string {
  if (value === null) {
    return '–'
  }
  switch (unit) {
    case 'ms':
      return `${value >= 100 ? value.toFixed(0) : value.toFixed(1)} ms`
    case 'ratio':
      return `${(value * 100).toFixed(value >= 0.1 ? 0 : 1)} %`
    case 'bytes':
      return `${(value / (1024 * 1024)).toFixed(1)} MB`
    case 'perSecond':
      return `${value.toFixed(1)}/s`
    case 'number':
      return value.toFixed(1)
    case 'flag':
      return value >= 1 ? '✓' : '✗'
    default:
      return String(Math.round(value))
  }
}
