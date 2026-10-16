import { MetricCollector } from '../../metrics/application/metric-collectors'

export interface LifecycleReport {
  unverifiedAccountsDeleted: number
  inactivityNoticesSent: number
  inactiveAccountsErased: number
  terminalLogsDeleted: number
  terminalSessionsDeleted: number
  executionsDeleted: number
  notificationsDeleted: number
  authRowsDeleted: number
  playerActivityDeleted: number
  monitoringHistoryDeleted: number
}

export const EMPTY_REPORT: LifecycleReport = {
  unverifiedAccountsDeleted: 0,
  inactivityNoticesSent: 0,
  inactiveAccountsErased: 0,
  terminalLogsDeleted: 0,
  terminalSessionsDeleted: 0,
  executionsDeleted: 0,
  notificationsDeleted: 0,
  authRowsDeleted: 0,
  playerActivityDeleted: 0,
  monitoringHistoryDeleted: 0
}

// What the cleanup job did, for the metrics and the admin console (design §25, "Operations")
export class LifecycleStatus {
  private lastRunAt: Date | null = null
  private failures = 0
  private readonly totals: LifecycleReport = { ...EMPTY_REPORT }

  recordRun(report: LifecycleReport, at: Date): void {
    this.lastRunAt = at
    for (const key of Object.keys(report) as Array<keyof LifecycleReport>) {
      this.totals[key] += report[key]
    }
  }

  recordFailure(): void {
    this.failures += 1
  }

  snapshot() {
    return { lastRunAt: this.lastRunAt, failures: this.failures, totals: { ...this.totals } }
  }
}

const SERIES: Array<[keyof LifecycleReport, string, string]> = [
  ['unverifiedAccountsDeleted', 'unverified_accounts', 'Accounts deleted because the email was never confirmed'],
  ['inactivityNoticesSent', 'inactivity_notices', 'Emails sent to players whose account is about to be erased'],
  ['inactiveAccountsErased', 'inactive_accounts', 'Accounts erased after a long inactivity'],
  ['terminalLogsDeleted', 'terminal_logs', 'Terminal log lines dropped by retention'],
  ['terminalSessionsDeleted', 'terminal_sessions', 'Empty ended terminal sessions dropped'],
  ['executionsDeleted', 'executions', 'Finished script executions dropped'],
  ['notificationsDeleted', 'notifications', 'Player notifications dropped by retention'],
  ['authRowsDeleted', 'auth_rows', 'Expired logins and links dropped'],
  ['playerActivityDeleted', 'player_activity', 'Days of player activity dropped by retention'],
  ['monitoringHistoryDeleted', 'monitoring_history', 'Minutes of the monitoring history dropped by retention']
]

// The series of the cleanup job for the metrics endpoint
export function collectLifecycleMetrics(status: LifecycleStatus): MetricCollector {
  return (text) => {
    const { lastRunAt, failures, totals } = status.snapshot()
    text
      .family(
        'botrts_lifecycle_last_run_timestamp_seconds',
        'gauge',
        'When the data lifecycle job last finished a pass (0: never)'
      )
      .sample('botrts_lifecycle_last_run_timestamp_seconds', lastRunAt ? Math.floor(lastRunAt.getTime() / 1000) : 0)
      .family('botrts_lifecycle_step_failures_total', 'counter', 'Steps of the data lifecycle job that failed')
      .sample('botrts_lifecycle_step_failures_total', failures)
    for (const [field, name, help] of SERIES) {
      text
        .family(`botrts_lifecycle_${name}_deleted_total`, 'counter', help)
        .sample(`botrts_lifecycle_${name}_deleted_total`, totals[field])
    }
  }
}
