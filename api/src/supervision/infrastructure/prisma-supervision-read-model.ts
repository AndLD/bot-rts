import { Prisma } from '@prisma/client'
import { ActiveExecution, SupervisionReadModel } from '../application/ports'

export class PrismaSupervisionReadModel implements SupervisionReadModel {
  constructor(private readonly db: Prisma.TransactionClient) {}

  findActive(executionId: string): Promise<ActiveExecution | null> {
    return this.db.execution.findFirst({
      where: { id: executionId, status: 'active' },
      select: { id: true, userId: true, botId: true }
    })
  }

  countActive(): Promise<number> {
    return this.db.execution.count({ where: { status: 'active' } })
  }

  countActiveOf(userIds: readonly string[]): Promise<number> {
    return userIds.length
      ? this.db.execution.count({ where: { status: 'active', userId: { in: [...userIds] } } })
      : Promise.resolve(0)
  }
}
