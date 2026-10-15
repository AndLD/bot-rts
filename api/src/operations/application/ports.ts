import { IBackupStatus, IJobStatus, IMaintenanceBanner } from '../../../../lib/utils/admin-operations'

export const MAINTENANCE_STORE = Symbol('MaintenanceStore')
export const JOB_STATUS_STORE = Symbol('JobStatusStore')
export const BACKUP_STATUS_READER = Symbol('BackupStatusReader')
export const ANNOUNCEMENT_RECIPIENTS = Symbol('AnnouncementRecipients')
export const ANNOUNCER = Symbol('Announcer')

// Where the maintenance banner is kept, so that every node shows the same one
export interface MaintenanceStore {
  get(): Promise<IMaintenanceBanner | null>
  save(banner: IMaintenanceBanner | null): Promise<void>
}

// The last report of each background job, written by the node that runs it and read by the console from any node
export interface JobStatusStore {
  record(status: IJobStatus): Promise<void>
  list(): Promise<IJobStatus[]>
}

// What the last backup was, as the backup job recorded it
export interface BackupStatusReader {
  read(): Promise<IBackupStatus>
}

// The players an announcement goes to, a page at a time (the ids after `after`, in order)
export interface AnnouncementRecipients {
  page(after: string | null, limit: number): Promise<string[]>
}

// Tells players of an announcement through the notification system
export interface Announcer {
  announce(userIds: readonly string[], text: string): Promise<void>
}
