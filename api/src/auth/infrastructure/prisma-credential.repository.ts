import { Prisma } from '@prisma/client'
import { CredentialRepository } from '../application/ports'
import { LocalCredential } from '../domain/local-credential'

export class PrismaCredentialRepository implements CredentialRepository {
  constructor(private readonly db: Prisma.TransactionClient) {}

  async findByUserId(userId: string): Promise<LocalCredential | null> {
    return await this.db.localCredential.findUnique({ where: { userId } })
  }

  async add(credential: LocalCredential): Promise<void> {
    await this.db.localCredential.create({ data: credential })
  }

  async update({ userId, ...data }: LocalCredential): Promise<void> {
    await this.db.localCredential.update({ where: { userId }, data })
  }

  async deleteByUserId(userId: string): Promise<void> {
    await this.db.localCredential.deleteMany({ where: { userId } })
  }
}
