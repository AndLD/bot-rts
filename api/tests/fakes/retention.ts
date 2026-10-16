import { RetentionJob, RetentionSettings, RetentionValues } from '../../../lib/utils/admin-retention'
import { RetentionPolicy } from '../../src/retention/application/retention-settings.service'

// The retention values a server without configuration starts with (the environment's defaults)
export const DEFAULT_RETENTION: RetentionSettings = {
  lifecycle: { isEnabled: true, intervalMinutes: 60 },
  terminalLogs: { isEnabled: true, logDays: 30, securityDays: 90, maxLinesPerBot: 5000 },
  executions: { isEnabled: true, days: 30 },
  notifications: { isEnabled: true, days: 30 },
  authData: { isEnabled: true, days: 7 },
  unverifiedAccounts: { isEnabled: true, days: 7 },
  inactiveAccounts: { isEnabled: true, inactiveDays: 365, noticeDays: 30 },
  playerActivity: { isEnabled: true, days: 400 },
  monitoring: { fineDays: 7, coarseDays: 30 },
  logs: { days: 14 }
}

export function retentionWith(overrides: Partial<Record<RetentionJob, RetentionValues>> = {}): RetentionSettings {
  return Object.fromEntries(
    (Object.keys(DEFAULT_RETENTION) as RetentionJob[]).map((job) => [
      job,
      { ...DEFAULT_RETENTION[job], ...overrides[job] }
    ])
  ) as RetentionSettings
}

export function fakeRetentionPolicy(overrides: Partial<Record<RetentionJob, RetentionValues>> = {}): RetentionPolicy {
  const settings = retentionWith(overrides)

  return { current: async () => settings, snapshot: () => settings }
}
