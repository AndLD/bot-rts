import { ApiKey as ApiKeyRow, Prisma } from '@prisma/client'
import { ApiScope } from '../../../../lib/utils/interfaces/api-keys'
import { ApiKeyRepository } from '../application/api-key.repository'
import { ApiKey } from '../domain/api-key'

const toEntity = (row: ApiKeyRow): ApiKey => ({ ...row, scopes: row.scopes as ApiScope[] })

export class PrismaApiKeyRepository implements ApiKeyRepository {
  constructor(private readonly db: Prisma.TransactionClient) {}

  async add(key: ApiKey): Promise<void> {
    await this.db.apiKey.create({ data: { ...key, scopes: [...key.scopes] } })
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
    const row = await this.db.apiKey.findFirst({ where: { id, userId } })
    return row && toEntity(row)
  }

  async listOfUser(userId: string): Promise<ApiKey[]> {
    const rows = await this.db.apiKey.findMany({ where: { userId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] })
    return rows.map(toEntity)
  }

  countActiveOfUser(userId: string, now: Date): Promise<number> {
    return this.db.apiKey.count({
      where: { userId, revokedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }
    })
  }

  async revoke(id: string, at: Date): Promise<void> {
    await this.db.apiKey.update({ where: { id }, data: { revokedAt: at } })
  }

  async touch(id: string, at: Date): Promise<void> {
    await this.db.apiKey.update({ where: { id }, data: { lastUsedAt: at } })
  }
}
