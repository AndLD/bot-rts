import { Prisma, Session as SessionRow } from '@prisma/client'
import { SessionRepository } from '../application/ports'
import { Session } from '../domain/session'

export function toSession({ viewAsUserId, viewAsReason, ...row }: SessionRow): Session {
  return { ...row, viewAs: viewAsUserId ? { userId: viewAsUserId, reason: viewAsReason as string } : null }
}

function toRow({ viewAs, ...session }: Session) {
  return { ...session, viewAsUserId: viewAs?.userId ?? null, viewAsReason: viewAs?.reason ?? null }
}

export class PrismaSessionRepository implements SessionRepository {
  constructor(private readonly db: Prisma.TransactionClient) {}

  async findById(id: string): Promise<Session | null> {
    const row = await this.db.session.findUnique({ where: { id } })

    return row && toSession(row)
  }

  async findByRefreshTokenHash(hash: string): Promise<Session | null> {
    const row = await this.db.session.findUnique({ where: { refreshTokenHash: hash } })

    return row && toSession(row)
  }

  async add(session: Session): Promise<void> {
    await this.db.session.create({ data: toRow(session) })
  }

  async update(session: Session): Promise<void> {
    const { id, ...data } = toRow(session)

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
