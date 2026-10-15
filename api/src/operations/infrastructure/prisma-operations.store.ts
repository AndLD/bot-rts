import { Prisma, PrismaClient } from '@prisma/client'
import { IJobStatus, IMaintenanceBanner } from '../../../../lib/utils/admin-operations'
import { Clock } from '../../shared/application/clock'
import { JobStatusStore, MaintenanceStore } from '../application/ports'

export const BANNER_KEY = 'maintenance.banner'
export const JOB_KEY_PREFIX = 'job.'

// The banner and the status of the jobs are small documents in the game settings
export class PrismaOperationsStore implements MaintenanceStore, JobStatusStore {
  constructor(
    private readonly db: PrismaClient,
    private readonly clock: Clock
  ) {}

  async get(): Promise<IMaintenanceBanner | null> {
    const row = await this.db.gameSetting.findUnique({ where: { key: BANNER_KEY } })

    return (row?.value as IMaintenanceBanner | null | undefined) ?? null
  }

  async save(banner: IMaintenanceBanner | null): Promise<void> {
    await this.write(BANNER_KEY, banner as Prisma.InputJsonValue | null)
  }

  async list(): Promise<IJobStatus[]> {
    const rows = await this.db.gameSetting.findMany({
      where: { key: { startsWith: JOB_KEY_PREFIX } },
      orderBy: { key: 'asc' }
    })

    return rows.map((row) => row.value as unknown as IJobStatus)
  }

  async record(status: IJobStatus): Promise<void> {
    await this.write(`${JOB_KEY_PREFIX}${status.name}`, status as unknown as Prisma.InputJsonValue)
  }

  private async write(key: string, value: Prisma.InputJsonValue | null): Promise<void> {
    const stored = value ?? Prisma.JsonNull
    const updatedAt = this.clock.now()

    await this.db.gameSetting.upsert({
      where: { key },
      create: { key, value: stored, updatedAt },
      update: { value: stored, updatedAt }
    })
  }
}
