import type { MonitorArea } from '../../../../lib/utils/admin'
import { Severity } from './metric-catalog'

export interface Alert {
  readonly id: string
  readonly metric: string
  readonly area: MonitorArea
  readonly severity: Severity
  readonly value: number
  readonly threshold: number
  readonly openedAt: Date
  readonly clearedAt: Date | null
  readonly acknowledgedAt: Date | null
  readonly acknowledgedBy: string | null
}
