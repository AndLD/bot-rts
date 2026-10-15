import { readFile } from 'fs/promises'
import { IBackupRecord, IBackupStatus } from '../../../../lib/utils/admin-operations'
import { BackupStatusReader } from '../application/ports'

const NOT_CONFIGURED: IBackupStatus = { isConfigured: false, finishedAt: null, sizeBytes: null, location: null }

// The backup is made by the database host or an operator's job, not by the application. That job writes a small JSON file when it
// finishes (`BACKUP_STATUS_FILE`, docs/operations/DEPLOYMENT.md); this reads it, so the console can show the age of the last backup.
export class FileBackupStatusReader implements BackupStatusReader {
  constructor(private readonly path: string | null) {}

  async read(): Promise<IBackupStatus> {
    if (!this.path) {
      return NOT_CONFIGURED
    }
    try {
      const record = JSON.parse(await readFile(this.path, 'utf8')) as IBackupRecord
      const finishedAt = Date.parse(record.finishedAt)

      return {
        isConfigured: true,
        finishedAt: Number.isFinite(finishedAt) ? finishedAt : null,
        sizeBytes: typeof record.sizeBytes === 'number' ? record.sizeBytes : null,
        location: typeof record.location === 'string' ? record.location : null
      }
    } catch {
      // No file yet, or one that is not a record: the job has not reported
      return { ...NOT_CONFIGURED, isConfigured: true }
    }
  }
}
