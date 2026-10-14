import { Prisma } from '@prisma/client'
import { AuditLog } from '../application/ports'
import { AuditEntry, AuditFilter, AuditOutcome } from '../domain/audit-entry'

type Row = Prisma.AdminAuditEntryGetPayload<object>

const json = (value: unknown) =>
  value === undefined || value === null ? Prisma.DbNull : (value as Prisma.InputJsonValue)

const toEntity = (row: Row): AuditEntry => ({ ...row, outcome: row.outcome as AuditOutcome })

export class PrismaAuditLog implements AuditLog {
  constructor(private readonly db: Prisma.TransactionClient) {}

  async append(entry: AuditEntry): Promise<void> {
    await this.db.adminAuditEntry.create({ data: { ...entry, before: json(entry.before), after: json(entry.after) } })
  }

  async list(filter: AuditFilter, { page, pageSize }: { page: number; pageSize: number }) {
    const where: Prisma.AdminAuditEntryWhereInput = {
      actorId: filter.actorId,
      action: filter.action,
      targetId: filter.targetId,
      outcome: filter.outcome,
      at: { gte: filter.from, lte: filter.to }
    }
    const [rows, total] = await Promise.all([
      this.db.adminAuditEntry.findMany({
        where,
        orderBy: [{ at: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize
      }),
      this.db.adminAuditEntry.count({ where })
    ])

    return { entries: rows.map(toEntity), total }
  }
}
