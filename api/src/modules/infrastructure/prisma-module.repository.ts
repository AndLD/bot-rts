import { Module as ModuleRow, Prisma } from '@prisma/client'
import { ModuleType } from '../../../../lib/utils/interfaces/modules'
import { ModuleRepository } from '../application/module.repository'
import { Module } from '../domain/module.entity'

export function toModuleEntity(row: ModuleRow): Module {
  const { type, props, ...rest } = row
  return { ...rest, type: type as ModuleType, props: props as Record<string, unknown> }
}

export function toModuleRow(module: Module): Prisma.ModuleCreateManyInput {
  return { ...module, props: module.props as Prisma.InputJsonObject }
}

export class PrismaModuleRepository implements ModuleRepository {
  constructor(private readonly db: Prisma.TransactionClient) {}

  async addMany(modules: Module[]): Promise<void> {
    await this.db.module.createMany({ data: modules.map(toModuleRow) })
  }

  async listOfBot(botId: string): Promise<Module[]> {
    const rows = await this.db.module.findMany({ where: { botId }, orderBy: { id: 'asc' } })
    return rows.map(toModuleEntity)
  }
}
