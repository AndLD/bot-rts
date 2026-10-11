import { Prisma } from '@prisma/client'
import { AuthTokenRepository } from '../application/ports'
import { AuthToken, AuthTokenKind } from '../domain/auth-token'

export class PrismaAuthTokenRepository implements AuthTokenRepository {
  constructor(private readonly db: Prisma.TransactionClient) {}

  async findByHash(hash: string): Promise<AuthToken | null> {
    return await this.db.authToken.findUnique({ where: { tokenHash: hash } })
  }

  async add(token: AuthToken): Promise<void> {
    await this.db.authToken.create({ data: token })
  }

  async markUsed(id: string, now: Date): Promise<void> {
    await this.db.authToken.update({ where: { id }, data: { usedAt: now } })
  }

  async expirePending(userId: string, kind: AuthTokenKind, now: Date): Promise<void> {
    await this.db.authToken.updateMany({
      where: { userId, kind, usedAt: null, expiresAt: { gt: now } },
      data: { expiresAt: now }
    })
  }

  async deleteByUserId(userId: string): Promise<void> {
    await this.db.authToken.deleteMany({ where: { userId } })
  }
}
