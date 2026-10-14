import { Prisma } from '@prisma/client'
import { IBotLockout, IFailedLoginGroup, IMultiIpAccount, ISameIpGroup } from '../../../../lib/utils/admin-security'
import { KeyRow, SecurityReadModel } from '../application/ports'

const FAILED = Prisma.sql`outcome <> 'success'`

export class PrismaSecurityReadModel implements SecurityReadModel {
  constructor(private readonly db: Prisma.TransactionClient) {}

  async failedLoginsByIp(since: Date, limit: number): Promise<IFailedLoginGroup[]> {
    const rows = await this.db.$queryRaw<Array<{ key: string; failures: bigint; emails: bigint; last: Date }>>`
      SELECT ip AS key, COUNT(*) AS failures, COUNT(DISTINCT email) AS emails, MAX(at) AS last
      FROM login_attempts
      WHERE ${FAILED} AND at >= ${since} AND ip IS NOT NULL
      GROUP BY ip
      ORDER BY failures DESC, last DESC
      LIMIT ${limit}`

    return rows.map((row) => ({
      key: row.key,
      failures: Number(row.failures),
      distinctEmails: Number(row.emails),
      lastAt: row.last.getTime()
    }))
  }

  async failedLoginsByEmail(since: Date, limit: number): Promise<IFailedLoginGroup[]> {
    const rows = await this.db.$queryRaw<Array<{ key: string; failures: bigint; last: Date }>>`
      SELECT email AS key, COUNT(*) AS failures, MAX(at) AS last
      FROM login_attempts
      WHERE ${FAILED} AND at >= ${since}
      GROUP BY email
      ORDER BY failures DESC, last DESC
      LIMIT ${limit}`

    return rows.map((row) => ({
      key: row.key,
      failures: Number(row.failures),
      distinctEmails: 1,
      lastAt: row.last.getTime()
    }))
  }

  async sameIpAccounts(since: Date, min: number, limit: number): Promise<ISameIpGroup[]> {
    const rows = await this.db.$queryRaw<Array<{ ip: string; accounts: Array<{ id: string; name: string }> }>>`
      SELECT a.ip AS ip, JSONB_AGG(DISTINCT JSONB_BUILD_OBJECT('id', u.id, 'name', u.name)) AS accounts
      FROM login_attempts a
      JOIN users u ON u.id = a.user_id
      WHERE a.outcome = 'success' AND a.at >= ${since} AND a.ip IS NOT NULL
      GROUP BY a.ip
      HAVING COUNT(DISTINCT a.user_id) >= ${min}
      ORDER BY COUNT(DISTINCT a.user_id) DESC
      LIMIT ${limit}`

    return rows.map((row) => ({
      ip: row.ip,
      accounts: row.accounts.map((account) => ({ _id: account.id, name: account.name }))
    }))
  }

  async multiIpAccounts(since: Date, min: number, limit: number): Promise<IMultiIpAccount[]> {
    const rows = await this.db.$queryRaw<Array<{ id: string; name: string; ips: bigint }>>`
      SELECT u.id::text AS id, u.name AS name, COUNT(DISTINCT a.ip) AS ips
      FROM login_attempts a
      JOIN users u ON u.id = a.user_id
      WHERE a.outcome = 'success' AND a.at >= ${since} AND a.ip IS NOT NULL
      GROUP BY u.id, u.name
      HAVING COUNT(DISTINCT a.ip) >= ${min}
      ORDER BY ips DESC
      LIMIT ${limit}`

    return rows.map((row) => ({ _id: row.id, name: row.name, ips: Number(row.ips) }))
  }

  async botLockouts(now: Date, limit: number): Promise<IBotLockout[]> {
    const rows = await this.db.botAccess.findMany({
      where: { lockedUntil: { gt: now } },
      orderBy: { lockedUntil: 'desc' },
      take: limit,
      include: { bot: { include: { user: true, base: { include: { user: true } } } } }
    })

    return rows.map(({ bot, failures, lockedUntil }) => {
      const owner = bot.user ?? bot.base?.user ?? null

      return {
        botId: bot.id,
        label: bot.label,
        ownerId: owner?.id ?? null,
        ownerName: owner?.name ?? null,
        failures,
        lockedUntil: (lockedUntil as Date).getTime()
      }
    })
  }

  async apiKeys(limit: number): Promise<KeyRow[]> {
    const rows = await this.db.apiKey.findMany({
      orderBy: [{ lastUsedAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
      take: limit,
      include: { user: true }
    })

    return rows.map(({ user, scopes, keyHash: _hash, userId: _userId, ...key }) => ({
      ...key,
      scopes: [...scopes],
      owner: { id: user.id, name: user.name }
    }))
  }

  async failedScripts(since: Date, codes: readonly string[], limit: number) {
    const rows = await this.db.execution.findMany({
      where: {
        status: 'killed',
        endedAt: { gte: since },
        OR: codes.map((code) => ({ reason: { startsWith: `${code}:` } }))
      },
      orderBy: { endedAt: 'desc' },
      take: limit,
      include: { user: true }
    })

    return rows.map((row) => ({
      executionId: row.id,
      owner: { _id: row.user.id, name: row.user.name },
      botId: row.botId,
      file: row.file,
      reason: row.reason as string,
      endedAt: (row.endedAt as Date).getTime()
    }))
  }
}
