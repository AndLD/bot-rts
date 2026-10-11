import { Prisma } from '@prisma/client'
import { IdentityLink } from '../domain/identity'
import { IdentityRepository } from '../application/ports'

export class PrismaIdentityRepository implements IdentityRepository {
  constructor(private readonly db: Prisma.TransactionClient) {}

  async findByIdentity(provider: string, subject: string): Promise<IdentityLink | null> {
    return await this.db.identity.findUnique({ where: { provider_subject: { provider, subject } } })
  }

  async add(link: IdentityLink): Promise<void> {
    await this.db.identity.create({ data: link })
  }

  async deleteByUserId(userId: string): Promise<void> {
    await this.db.identity.deleteMany({ where: { userId } })
  }
}
