// The Operations page of the admin console (design §25.3): what runs, the cleanup jobs, the backup, announcements and the
// maintenance banner.

export const ANNOUNCEMENT_MAX_LENGTH = 500
export const BANNER_MAX_LENGTH = 300

// What players are shown ahead of, and during, maintenance. The hours are milliseconds since the epoch.
export interface IMaintenanceBanner {
  message: string
  startsAt: number
  // When maintenance is expected to end; null while unknown
  endsAt: number | null
}

// What every visitor may ask: whether the world is paused, and the banner
export interface IMaintenanceStatus {
  isPaused: boolean
  banner: IMaintenanceBanner | null
}

export interface IEngineStatus {
  // False when the engine did not answer
  isResponding: boolean
  uptimeMs: number
  tick: number
  lastTickMs: number
  p95TickMs: number
  executions: number
  memoryBytes: number
}

export interface IJobStatus {
  // `lifecycle`: the data lifecycle job (retention, expiry of accounts and logins)
  name: string
  // Null while it has not run since the status was first stored
  lastRunAt: number | null
  failures: number
  // What it removed or did, in all, by kind
  totals: Record<string, number>
  // The same for the last pass alone (absent in a status stored before it was reported)
  lastPass?: Record<string, number>
}

export interface IBackupStatus {
  // False when the server was not told where the record of backups is
  isConfigured: boolean
  finishedAt: number | null
  sizeBytes: number | null
  location: string | null
}

export interface IOperationsStatus {
  engine: IEngineStatus
  isPaused: boolean
  areScriptsHalted: boolean
  jobs: IJobStatus[]
  backup: IBackupStatus
  banner: IMaintenanceBanner | null
}

export interface IAnnouncementResult {
  // How many players were told
  recipients: number
}

export interface IRestartResult {
  // The scripts that were started again from the beginning, and the bots that could not be restarted
  restarted: number
  failedBots: number
}

// What a backup job writes to the file named by `BACKUP_STATUS_FILE` when it finishes
export interface IBackupRecord {
  finishedAt: string
  sizeBytes?: number
  location?: string
}
