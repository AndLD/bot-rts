import { AuditEntry } from './audit-entry'

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

// A cell that starts like a formula would be run by a spreadsheet, so it is made plain text
function cell(value: unknown): string {
  const text = value === null || value === undefined ? '' : typeof value === 'string' ? value : JSON.stringify(value)
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text

  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

// The audit trail as CSV for the export of the console
export function auditCsv(entries: readonly AuditEntry[]): string {
  const rows = entries.map((entry) =>
    [
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
    ]
      .map(cell)
      .join(',')
  )

  return `${[COLUMNS.join(','), ...rows].join('\n')}\n`
}
