import { Execution as ExecutionRow, Prisma, PrismaClient } from '@prisma/client'
import { ExecutionRepository } from '../application/execution.repository'
import { Execution, ExecutionStatus } from '../domain/execution'
import { JsonValue } from '../domain/json-value'

function toExecution(row: ExecutionRow): Execution {
  return { ...row, args: row.args as JsonValue[], status: row.status as ExecutionStatus }
}

function toRow(execution: Execution) {
  return { ...execution, args: execution.args as Prisma.InputJsonValue }
}

export class PrismaExecutionRepository implements ExecutionRepository {
  constructor(private readonly db: PrismaClient) {}

  async add(execution: Execution): Promise<void> {
    await this.db.execution.create({ data: toRow(execution) })
  }

  async update(execution: Execution): Promise<void> {
    await this.db.execution.update({ where: { id: execution.id }, data: toRow(execution) })
  }

  async findById(id: string): Promise<Execution | null> {
    const row = await this.db.execution.findUnique({ where: { id } })
    return row && toExecution(row)
  }

  async listActive(): Promise<Execution[]> {
    const rows = await this.db.execution.findMany({
      where: { status: ExecutionStatus.ACTIVE },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }]
    })
    return rows.map(toExecution)
  }
}
