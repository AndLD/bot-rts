import { PrismaClient } from '@prisma/client'
import { TEST_EMAIL_DOMAIN } from '../../../../lib/utils/admin-devtools'
import { TestPlayerDirectory } from '../application/ports'

export class PrismaTestPlayerDirectory implements TestPlayerDirectory {
  constructor(private readonly db: PrismaClient) {}

  async activeIds(limit: number): Promise<string[]> {
    const users = await this.db.user.findMany({
      where: { email: { endsWith: `@${TEST_EMAIL_DOMAIN}` }, deletedAt: null },
      select: { id: true },
      take: limit
    })

    return users.map((user) => user.id)
  }
}
