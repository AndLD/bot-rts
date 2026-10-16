import { RetentionSettings } from '../../../../lib/utils/admin-retention'
import { AppConfig } from '../../config/app-config'

const DAY_MS = 24 * 60 * 60 * 1000
const MINUTE_MS = 60 * 1000
// The erasure of inactive accounts is off in the environment when its days are 0; the console then starts from this value
const FALLBACK_INACTIVE_DAYS = 365
// The ceiling of the logs' range (`RETENTION_RANGES.logs.days`): an environment value beyond it starts from the ceiling
const MAX_LOG_DAYS = 365

// The values in force when nobody has changed anything in the console: what the environment says
export function retentionDefaults({
  lifecycle,
  terminal,
  notifications,
  monitoring,
  observability
}: AppConfig): RetentionSettings {
  return {
    lifecycle: { isEnabled: true, intervalMinutes: lifecycle.intervalMs / MINUTE_MS },
    terminalLogs: {
      isEnabled: true,
      logDays: terminal.logDays,
      securityDays: terminal.securityDays,
      maxLinesPerBot: terminal.maxLinesPerBot
    },
    executions: { isEnabled: true, days: lifecycle.executionDays },
    notifications: { isEnabled: true, days: notifications.retentionDays },
    authData: { isEnabled: true, days: lifecycle.authDays },
    unverifiedAccounts: { isEnabled: true, days: lifecycle.unverifiedDays },
    inactiveAccounts: {
      isEnabled: lifecycle.inactiveDays > 0,
      inactiveDays: lifecycle.inactiveDays > 0 ? lifecycle.inactiveDays : FALLBACK_INACTIVE_DAYS,
      noticeDays: lifecycle.noticeDays
    },
    playerActivity: { isEnabled: true, days: lifecycle.activityDays },
    monitoring: {
      fineDays: Math.max(1, Math.ceil(monitoring.fineRetentionMs / DAY_MS)),
      coarseDays: Math.max(1, Math.ceil(monitoring.coarseRetentionMs / DAY_MS))
    },
    logs: { days: Math.min(MAX_LOG_DAYS, Math.max(1, observability.logRetentionDays)) }
  }
}
