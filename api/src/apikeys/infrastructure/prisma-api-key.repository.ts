import { ApiKey as ApiKeyRow, Prisma } from '@prisma/client'
import { ApiKeyRepository } from '../application/api-key.repository'
import { GrantedScope } from '../../../../lib/utils/admin-api-keys'
import { ApiKey } from '../domain/api-key'

const toEntity = ({ isAdminKey, grantReason, ipAllowList, ...row }: ApiKeyRow): ApiKey => ({
  ...row,
  scopes: row.scopes as GrantedScope[],
  adminGrant: isAdminKey ? { reason: grantReason ?? '', ipAllowList } : null
})

const toRow = ({ adminGrant, scopes, ...key }: ApiKey): Prisma.ApiKeyUncheckedCreateInput => ({
  ...key,
  scopes: [...scopes],
  isAdminKey: adminGrant !== null,
  grantReason: adminGrant?.reason ?? null,
  ipAllowList: [...(adminGrant?.ipAllowList ?? [])]
})

const activeAt = (now: Date): Prisma.ApiKeyWhereInput => ({
  revokedAt: null,
  OR: [{ expiresAt: null }, { expiresAt: { gt: now } }]
})

export class PrismaApiKeyRepository implements ApiKeyRepository {
  constructor(private readonly db: Prisma.TransactionClient) {}

  async add(key: ApiKey): Promise<void> {
    await this.db.apiKey.create({ data: toRow(key) })
  }

  async findByHash(keyHash: string): Promise<ApiKey | null> {
    const row = await this.db.apiKey.findUnique({ where: { keyHash } })
    return row && toEntity(row)
  }

  async findById(id: string): Promise<ApiKey | null> {
    const row = await this.db.apiKey.findUnique({ where: { id } })
    return row && toEntity(row)
  }

  async findOfUser(userId: string, id: string): Promise<ApiKey | null> {
    const row = await this.db.apiKey.findFirst({ where: { id, userId, isAdminKey: false } })
    return row && toEntity(row)
  }

  async listOfUser(userId: string): Promise<ApiKey[]> {
    const rows = await this.db.apiKey.findMany({
      where: { userId, isAdminKey: false },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }]
    })
    return rows.map(toEntity)
  }

  async listAdminKeys(): Promise<ApiKey[]> {
    const rows = await this.db.apiKey.findMany({
      where: { isAdminKey: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }]
    })
    return rows.map(toEntity)
  }

  countActiveOfUser(userId: string, now: Date): Promise<number> {
    return this.db.apiKey.count({ where: { userId, isAdminKey: false, ...activeAt(now) } })
  }

  countActiveAdminKeysOfUser(userId: string, now: Date): Promise<number> {
    return this.db.apiKey.count({ where: { userId, isAdminKey: true, ...activeAt(now) } })
  }

  async revoke(id: string, at: Date): Promise<void> {
    await this.db.apiKey.update({ where: { id }, data: { revokedAt: at } })
  }

  async touch(id: string, at: Date): Promise<void> {
    await this.db.apiKey.update({ where: { id }, data: { lastUsedAt: at } })
  }
}
