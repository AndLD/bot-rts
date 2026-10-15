import { AuditEntry } from './audit-entry'
import { toCsv } from './csv'

const COLUMNS = [
  'time',
  'actor',
  'role',
  'action',
  'outcome',
  'target type',
  'target',
  'reason',
  'before',
  'after',
  'ip',
  'request'
] as const

// The audit trail as CSV for the export of the console
export function auditCsv(entries: readonly AuditEntry[]): string {
  return toCsv(
    COLUMNS,
    entries.map((entry) => [
      entry.at.toISOString(),
      entry.actorId,
      entry.actorRole,
      entry.action,
      entry.outcome,
      entry.targetType,
      entry.targetId,
      entry.reason,
      entry.before,
      entry.after,
      entry.ip,
      entry.requestId
    ])
  )
}
