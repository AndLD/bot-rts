import { Prisma, PrismaClient } from '@prisma/client'
import { RetentionOverrides, RetentionStore, StoredRetention } from '../application/retention-settings.service'

const RETENTION_KEY = 'retention'

export class PrismaRetentionStore implements RetentionStore {
  constructor(private readonly db: PrismaClient) {}

  async load(): Promise<StoredRetention> {
    const row = await this.db.gameSetting.findUnique({ where: { key: RETENTION_KEY } })

    return { overrides: (row?.value as RetentionOverrides | null | undefined) ?? {}, updatedAt: row?.updatedAt ?? null }
  }

  async save(overrides: RetentionOverrides | null, at: Date): Promise<void> {
    if (overrides === null) {
      await this.db.gameSetting.deleteMany({ where: { key: RETENTION_KEY } })
      return
    }
    const value = overrides as Prisma.InputJsonValue

    await this.db.gameSetting.upsert({
      where: { key: RETENTION_KEY },
      create: { key: RETENTION_KEY, value, updatedAt: at },
      update: { value, updatedAt: at }
    })
  }
}
