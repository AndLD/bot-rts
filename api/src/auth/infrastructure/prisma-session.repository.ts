import { Prisma } from '@prisma/client'
import { SessionRepository } from '../application/ports'
import { Session } from '../domain/session'

export class PrismaSessionRepository implements SessionRepository {
  constructor(private readonly db: Prisma.TransactionClient) {}

  async findById(id: string): Promise<Session | null> {
    return await this.db.session.findUnique({ where: { id } })
  }

  async findByRefreshTokenHash(hash: string): Promise<Session | null> {
    return await this.db.session.findUnique({ where: { refreshTokenHash: hash } })
  }

  async add(session: Session): Promise<void> {
    await this.db.session.create({ data: session })
  }

  async update({ id, ...data }: Session): Promise<void> {
    await this.db.session.update({ where: { id }, data })
  }

  async revokeAllOfUser(userId: string, now: Date, exceptSessionId?: string): Promise<void> {
    await this.db.session.updateMany({
      where: { userId, revokedAt: null, ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}) },
      data: { revokedAt: now }
    })
  }

  async deleteByUserId(userId: string): Promise<void> {
    await this.db.session.deleteMany({ where: { userId } })
  }
}
