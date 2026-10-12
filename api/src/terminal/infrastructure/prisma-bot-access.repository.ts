import { Prisma } from '@prisma/client'
import { BotAccessRepository } from '../application/bot-access.repository'
import { AccessState } from '../domain/bot-security'

export class PrismaBotAccessRepository implements BotAccessRepository {
  constructor(private readonly db: Prisma.TransactionClient) {}

  async find(botId: string): Promise<AccessState | null> {
    const row = await this.db.botAccess.findUnique({ where: { botId } })
    return row && { failures: row.failures, lockedUntil: row.lockedUntil }
  }

  async save(botId: string, state: AccessState): Promise<void> {
    await this.db.botAccess.upsert({
      where: { botId },
      create: { botId, ...state },
      update: { ...state }
    })
  }
}
