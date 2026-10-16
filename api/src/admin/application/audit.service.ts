import { Clock } from '../../shared/application/clock'
import { IdGenerator } from '../../shared/application/id-generator'
import { AuditEntry, AuditFilter } from '../domain/audit-entry'
import { AuditLog } from './ports'

export type AuditRecord = Omit<AuditEntry, 'id' | 'at' | 'apiKeyId'> & { apiKeyId?: string | null }

export class AuditService {
  constructor(
    private readonly log: AuditLog,
    private readonly ids: IdGenerator,
    private readonly clock: Clock
  ) {}

  async record(record: AuditRecord): Promise<AuditEntry> {
    const entry: AuditEntry = {
      ...record,
      apiKeyId: record.apiKeyId ?? null,
      id: this.ids.next(),
      at: this.clock.now()
    }
    await this.log.append(entry)

    return entry
  }

  list(filter: AuditFilter, page: { page: number; pageSize: number }) {
    return this.log.list(filter, page)
  }
}
