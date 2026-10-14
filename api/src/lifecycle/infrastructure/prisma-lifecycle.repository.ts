import { Prisma } from '@prisma/client'
import { TERMINAL_LOG_KIND } from '../../../../lib/utils/interfaces/terminal'
import { InactiveAccount, LifecycleRepository } from '../application/lifecycle.repository'

// The moment a player was last seen: the newest login activity, or the sign-up for someone who never logged in
const LAST_ACTIVE = Prisma.sql`GREATEST(u.created_at, COALESCE((SELECT MAX(s.last_used_at) FROM sessions s WHERE s.user_id = u.id), u.created_at))`

interface InactiveRow {
  id: string
  name: string
  email: string
  inactivity_notice_at: Date | null
}

export class PrismaLifecycleRepository implements LifecycleRepository {
  constructor(private readonly db: Prisma.TransactionClient) {}

  async findStaleUnverifiedUserIds(before: Date, limit: number): Promise<string[]> {
    const rows = await this.db.$queryRaw<Array<{ id: string }>>`
      SELECT u.id FROM users u
      JOIN local_credentials c ON c.user_id = u.id AND c.email_verified = false
      WHERE u.deleted_at IS NULL AND u.created_at < ${before}
        AND NOT EXISTS (SELECT 1 FROM bots b WHERE b.user_id = u.id)
      ORDER BY u.created_at LIMIT ${limit}`

    return rows.map((row) => row.id)
  }

  async deleteUsers(userIds: readonly string[]): Promise<number> {
    const { count } = await this.db.user.deleteMany({ where: { id: { in: [...userIds] } } })
    return count
  }

  async findInactiveAccounts(lastActiveBefore: Date, limit: number): Promise<InactiveAccount[]> {
    const rows = await this.db.$queryRaw<InactiveRow[]>`
      SELECT u.id, u.name, u.email, u.inactivity_notice_at FROM users u
      WHERE u.deleted_at IS NULL AND u.status = 'user' AND u.subscription = 'free'
        AND ${LAST_ACTIVE} < ${lastActiveBefore}
        AND NOT EXISTS (SELECT 1 FROM executions e WHERE e.user_id = u.id AND e.status = 'active')
      ORDER BY u.created_at LIMIT ${limit}`

    return rows.map((row) => ({
      userId: row.id,
      name: row.name,
      email: row.email,
      noticeSentAt: row.inactivity_notice_at
    }))
  }

  async markInactivityNotice(userId: string, at: Date): Promise<void> {
    await this.db.user.update({ where: { id: userId }, data: { inactivityNoticeAt: at } })
  }

  async clearNoticesOfReturnedPlayers(): Promise<number> {
    return this.db.$executeRaw`
      UPDATE users u SET inactivity_notice_at = NULL
      WHERE u.inactivity_notice_at IS NOT NULL AND ${LAST_ACTIVE} > u.inactivity_notice_at`
  }

  async deleteTerminalLogsOlderThan(kinds: readonly TERMINAL_LOG_KIND[], before: Date): Promise<number> {
    const { count } = await this.db.terminalLog.deleteMany({ where: { kind: { in: [...kinds] }, at: { lt: before } } })
    return count
  }

  async deleteEndedTerminalSessionsWithoutLogs(before: Date): Promise<number> {
    const { count } = await this.db.terminalSession.deleteMany({
      where: { endedAt: { lt: before }, logs: { none: {} } }
    })
    return count
  }

  async deleteEndedExecutionsBefore(before: Date): Promise<number> {
    const { count } = await this.db.execution.deleteMany({
      where: { status: { not: 'active' }, endedAt: { lt: before } }
    })
    return count
  }

  async deleteExpiredAuthData(before: Date): Promise<number> {
    const sessions = await this.db.session.deleteMany({
      where: { OR: [{ expiresAt: { lt: before } }, { revokedAt: { lt: before } }] }
    })
    const tokens = await this.db.authToken.deleteMany({
      where: { OR: [{ expiresAt: { lt: before } }, { usedAt: { lt: before } }] }
    })
    const attempts = await this.db.loginAttempt.deleteMany({ where: { at: { lt: before } } })
    return sessions.count + tokens.count + attempts.count
  }
}
