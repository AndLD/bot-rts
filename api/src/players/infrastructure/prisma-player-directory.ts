import { Prisma } from '@prisma/client'
import { BOT_TYPE } from '../../../../lib/utils/interfaces/bots'
import { Session } from '../../auth/domain/session'
import { Bot } from '../../bots/domain/bot.entity'
import { PrismaBotRepository } from '../../bots/infrastructure/prisma-bot.repository'
import { PrismaModuleRepository } from '../../modules/infrastructure/prisma-module.repository'
import { PlayerActivity, PlayerDirectory, PlayerFilter, PlayerRow } from '../application/ports'

const SESSIONS_SHOWN = 20
const IS_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type UserWithCredential = Prisma.UserGetPayload<{ include: { credential: true } }>

function toRow(row: UserWithCredential, lastLoginAt: Date | null): PlayerRow {
  const { credential, ...user } = row

  return { ...user, isEmailVerified: credential?.emailVerified ?? false, lastLoginAt }
}

export class PrismaPlayerDirectory implements PlayerDirectory {
  constructor(private readonly db: Prisma.TransactionClient) {}

  async search(filter: PlayerFilter, { offset, limit }: { offset: number; limit: number }) {
    const where = this.where(filter)
    const direction = filter.isDescending ? 'desc' : 'asc'
    const [rows, total] = await Promise.all([
      this.db.user.findMany({
        where,
        include: { credential: true },
        orderBy: [{ [filter.sort]: direction }, { id: 'asc' }],
        skip: offset,
        take: limit
      }),
      this.db.user.count({ where })
    ])
    const logins = await this.lastLogins(rows.map((row) => row.id))

    return { players: rows.map((row) => toRow(row, logins.get(row.id) ?? null)), total }
  }

  async activityOf(userId: string): Promise<PlayerActivity | null> {
    const row = await this.db.user.findUnique({ where: { id: userId }, include: { credential: true } })

    if (!row) {
      return null
    }
    const bots = new PrismaBotRepository(this.db)
    const owned: Bot[] = await bots.listOfUser(userId)
    const [sessions, modules, runningExecutions] = await Promise.all([
      this.db.session.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: SESSIONS_SHOWN }),
      new PrismaModuleRepository(this.db).listOfBots(owned.map((bot) => bot.id)),
      this.db.execution.count({ where: { userId, status: 'active' } })
    ])
    const bases = owned.filter((bot) => bot.type === BOT_TYPE.BASE)

    return {
      user: toRow(row, sessions[0]?.createdAt ?? null),
      sessions: sessions as Session[],
      bases: bases.map((base) => ({ base, botCount: owned.filter((bot) => bot.baseId === base.id).length })),
      botCount: owned.length - bases.length,
      storages: modules.filter((module) => module.type === 'storage'),
      runningExecutions
    }
  }

  private where(filter: PlayerFilter): Prisma.UserWhereInput {
    const query = filter.query?.trim()

    return {
      deletedAt: null,
      status: filter.status,
      createdAt: { gte: filter.registeredFrom, lte: filter.registeredTo },
      AND: [this.verification(filter.isEmailVerified), this.matching(query)]
    }
  }

  private matching(query: string | undefined): Prisma.UserWhereInput {
    return query
      ? {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { email: { contains: query, mode: 'insensitive' } },
            ...(IS_UUID.test(query) ? [{ id: query }] : [])
          ]
        }
      : {}
  }

  // An account without credentials (a hosted provider) has no verified email here
  private verification(isEmailVerified: boolean | undefined): Prisma.UserWhereInput {
    if (isEmailVerified === undefined) {
      return {}
    }

    return isEmailVerified
      ? { credential: { is: { emailVerified: true } } }
      : { OR: [{ credential: { is: null } }, { credential: { is: { emailVerified: false } } }] }
  }

  private async lastLogins(userIds: string[]): Promise<Map<string, Date>> {
    const groups = await this.db.session.groupBy({
      by: ['userId'],
      where: { userId: { in: userIds } },
      _max: { createdAt: true }
    })

    return new Map(
      groups.flatMap((group) => (group._max.createdAt ? [[group.userId, group._max.createdAt] as const] : []))
    )
  }
}
