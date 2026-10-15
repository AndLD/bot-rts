import { PrismaClient } from '@prisma/client'
import { AnnouncementRecipients } from '../application/ports'

// Every player who is not banned
export class PrismaAnnouncementRecipients implements AnnouncementRecipients {
  constructor(private readonly db: PrismaClient) {}

  async page(after: string | null, limit: number): Promise<string[]> {
    const users = await this.db.user.findMany({
      where: { status: { not: 'banned' }, ...(after === null ? {} : { id: { gt: after } }) },
      select: { id: true },
      orderBy: { id: 'asc' },
      take: limit
    })

    return users.map((user) => user.id)
  }
}
