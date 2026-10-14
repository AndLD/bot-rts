import { Prisma, PrismaClient } from '@prisma/client'
import { IBalanceDocument } from '../../../../lib/utils/admin-balance'
import { BalanceRepository, BalanceVersionRecord } from '../application/ports'

export const ACTIVE_BALANCE_KEY = 'balance.active'

const toRecord = (row: {
  version: number
  document: Prisma.JsonValue
  reason: string
  createdBy: string
  createdAt: Date
}): BalanceVersionRecord => ({ ...row, document: row.document as IBalanceDocument })

export class PrismaBalanceRepository implements BalanceRepository {
  constructor(private readonly db: PrismaClient) {}

  async list(): Promise<BalanceVersionRecord[]> {
    return (await this.db.balanceVersion.findMany({ orderBy: { version: 'desc' } })).map(toRecord)
  }

  async find(version: number): Promise<BalanceVersionRecord | null> {
    const row = await this.db.balanceVersion.findUnique({ where: { version } })

    return row && toRecord(row)
  }

  addAndActivate(input: Omit<BalanceVersionRecord, 'version'>): Promise<BalanceVersionRecord> {
    return this.db.$transaction(async (db) => {
      const row = await db.balanceVersion.create({
        data: { ...input, document: input.document as Prisma.InputJsonValue }
      })
      const value = { version: row.version } as Prisma.InputJsonValue
      await db.gameSetting.upsert({
        where: { key: ACTIVE_BALANCE_KEY },
        create: { key: ACTIVE_BALANCE_KEY, value, updatedAt: input.createdAt },
        update: { value, updatedAt: input.createdAt }
      })

      return toRecord(row)
    })
  }

  async activeVersion(): Promise<number | null> {
    const row = await this.db.gameSetting.findUnique({ where: { key: ACTIVE_BALANCE_KEY } })

    return (row?.value as { version?: number } | undefined)?.version ?? null
  }
}
