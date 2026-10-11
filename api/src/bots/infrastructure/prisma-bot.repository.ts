import { Bot as BotRow, Prisma } from '@prisma/client'
import { BOT_TYPE } from '../../../../lib/utils/interfaces/bots'
import { BotRepository } from '../application/bot.repository'
import { Bot } from '../domain/bot.entity'

function toEntity(row: BotRow): Bot {
  return {
    id: row.id,
    label: row.label,
    type: row.type as BOT_TYPE,
    userId: row.userId,
    baseId: row.baseId,
    passwordHash: row.passwordHash
  }
}

export class PrismaBotRepository implements BotRepository {
  constructor(private readonly db: Prisma.TransactionClient) {}

  async findById(id: string): Promise<Bot | null> {
    const row = await this.db.bot.findUnique({ where: { id } })
    return row && toEntity(row)
  }

  async add(bot: Bot): Promise<void> {
    await this.db.bot.create({ data: { ...bot, type: bot.type } })
  }

  async listOfUser(userId: string, filter?: { type?: BOT_TYPE }): Promise<Bot[]> {
    const rows = await this.db.bot.findMany({
      where: { OR: [{ userId }, { base: { userId } }], type: filter?.type },
      orderBy: { id: 'asc' }
    })
    return rows.map(toEntity)
  }

  async listOfBase(baseId: string): Promise<Bot[]> {
    const rows = await this.db.bot.findMany({ where: { baseId }, orderBy: { id: 'asc' } })
    return rows.map(toEntity)
  }
}
