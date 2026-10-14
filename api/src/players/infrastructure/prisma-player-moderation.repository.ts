import { Prisma } from '@prisma/client'
import { PlayerModerationRepository } from '../application/ports'
import { PlayerBan, PlayerNote } from '../domain/player-moderation'

export class PrismaPlayerModerationRepository implements PlayerModerationRepository {
  constructor(private readonly db: Prisma.TransactionClient) {}

  async addBan(ban: PlayerBan): Promise<void> {
    await this.db.playerBan.create({ data: ban })
  }

  async updateBan({ id, ...data }: PlayerBan): Promise<void> {
    await this.db.playerBan.update({ where: { id }, data })
  }

  listBans(userId: string): Promise<PlayerBan[]> {
    return this.db.playerBan.findMany({ where: { userId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] })
  }

  listExpiredBans(now: Date): Promise<PlayerBan[]> {
    return this.db.playerBan.findMany({
      where: { liftedAt: null, expiresAt: { lte: now } },
      orderBy: { expiresAt: 'asc' }
    })
  }

  async addNote(note: PlayerNote): Promise<void> {
    await this.db.playerNote.create({ data: note })
  }

  listNotes(userId: string): Promise<PlayerNote[]> {
    return this.db.playerNote.findMany({ where: { userId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] })
  }
}
