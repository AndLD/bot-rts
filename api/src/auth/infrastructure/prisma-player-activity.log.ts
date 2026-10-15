import { Prisma } from '@prisma/client'
import { PlayerActivityLog } from '../application/ports'

export class PrismaPlayerActivityLog implements PlayerActivityLog {
  constructor(private readonly db: Prisma.TransactionClient) {}

  async touch(userId: string, at: Date): Promise<void> {
    const day = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()))

    await this.db.playerActivity.createMany({ data: [{ userId, day }], skipDuplicates: true })
  }
}
