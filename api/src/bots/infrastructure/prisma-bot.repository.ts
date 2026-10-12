import { Bot as BotRow, Prisma } from '@prisma/client'
import { Heading, Location } from '../../../../lib/utils/interfaces/map'
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
    passwordHash: row.passwordHash,
    lastPosition: row.lastX === null ? null : { x: row.lastX, y: row.lastY as number, z: row.lastZ as number },
    heading: row.heading as Heading
  }
}

export class PrismaBotRepository implements BotRepository {
  constructor(private readonly db: Prisma.TransactionClient) {}

  async findById(id: string): Promise<Bot | null> {
    const row = await this.db.bot.findUnique({ where: { id } })
    return row && toEntity(row)
  }

  async add(bot: Bot): Promise<void> {
    const { lastPosition, ...fields } = bot
    await this.db.bot.create({
      data: { ...fields, lastX: lastPosition?.x, lastY: lastPosition?.y, lastZ: lastPosition?.z }
    })
  }

  async listOfUser(userId: string, filter?: { type?: BOT_TYPE }): Promise<Bot[]> {
    const rows = await this.db.bot.findMany({
      where: { OR: [{ userId }, { base: { userId } }], type: filter?.type },
      orderBy: { id: 'asc' }
    })
    return rows.map(toEntity)
  }

  async setLastPosition(botId: string, { x, y, z = 0 }: Location): Promise<void> {
    await this.db.bot.update({ where: { id: botId }, data: { lastX: x, lastY: y, lastZ: z } })
  }

  async listOfBase(baseId: string): Promise<Bot[]> {
    const rows = await this.db.bot.findMany({ where: { baseId }, orderBy: { id: 'asc' } })
    return rows.map(toEntity)
  }

  async setPasswordHash(botId: string, passwordHash: string): Promise<void> {
    await this.db.bot.update({ where: { id: botId }, data: { passwordHash } })
  }

  async setBase(botId: string, baseId: string): Promise<void> {
    await this.db.bot.update({ where: { id: botId }, data: { baseId } })
  }
}
