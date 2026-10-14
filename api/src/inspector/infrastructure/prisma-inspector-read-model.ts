import { Prisma } from '@prisma/client'
import { Execution, ExecutionStatus } from '../../engine/domain/execution'
import { LocationRange } from '../../map/domain/map-point.entity'
import { InspectorLogLine, InspectorReadModel } from '../application/ports'

export class PrismaInspectorReadModel implements InspectorReadModel {
  constructor(private readonly db: Prisma.TransactionClient) {}

  async recentExecutions(botId: string, limit: number): Promise<Execution[]> {
    const rows = await this.db.execution.findMany({ where: { botId }, orderBy: { createdAt: 'desc' }, take: limit })

    return rows.map((row) => ({
      ...row,
      args: row.args as Execution['args'],
      status: row.status as ExecutionStatus
    }))
  }

  recentLogs(botId: string, limit: number): Promise<InspectorLogLine[]> {
    return this.db.terminalLog.findMany({ where: { botId }, orderBy: [{ at: 'desc' }, { id: 'desc' }], take: limit })
  }

  async activeExecutionLocations({ from, to }: LocationRange): Promise<Array<{ x: number; y: number }>> {
    const active = await this.db.execution.findMany({
      where: { status: 'active' },
      distinct: ['botId'],
      select: { botId: true }
    })

    return this.db.mapPoint.findMany({
      where: {
        contentId: { in: active.map((execution) => execution.botId) },
        x: { gte: from.x, lte: to.x },
        y: { gte: from.y, lte: to.y }
      },
      select: { x: true, y: true }
    })
  }
}
