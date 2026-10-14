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

// Writes modules in one statement: the rows travel as one JSON document (typed arrays with NULL elements are not inferred
// reliably by the driver). With `isInsert` missing rows are created, otherwise only existing rows change.
export async function writeModules(db: Prisma.TransactionClient, modules: readonly Module[], isInsert: boolean) {
  if (!modules.length) {
    return
  }
  const rows = JSON.stringify(modules)
  const recordset = Prisma.sql`jsonb_to_recordset(${rows}::jsonb)
    AS r(id uuid, "botId" uuid, type text, name text, condition float8, "maxCondition" float8, weight float8,
         "operationCost" float8, "idleCost" float8, props jsonb)`

  if (isInsert) {
    await db.$executeRaw`
      INSERT INTO modules (id, bot_id, type, name, condition, max_condition, weight, operation_cost, idle_cost, props)
      SELECT id, "botId", type, name, condition, "maxCondition", weight, "operationCost", "idleCost", props FROM ${recordset}
      ON CONFLICT (id) DO UPDATE
        SET bot_id = EXCLUDED.bot_id, type = EXCLUDED.type, name = EXCLUDED.name, condition = EXCLUDED.condition,
            max_condition = EXCLUDED.max_condition, weight = EXCLUDED.weight, operation_cost = EXCLUDED.operation_cost,
            idle_cost = EXCLUDED.idle_cost, props = EXCLUDED.props`
  } else {
    await db.$executeRaw`
      UPDATE modules SET bot_id = r."botId", type = r.type, name = r.name, condition = r.condition,
        max_condition = r."maxCondition", weight = r.weight, operation_cost = r."operationCost",
        idle_cost = r."idleCost", props = r.props
      FROM ${recordset} WHERE modules.id = r.id`
  }
}

export class PrismaModuleRepository implements ModuleRepository {
  constructor(private readonly db: Prisma.TransactionClient) {}

  async addMany(modules: Module[]): Promise<void> {
    await this.db.module.createMany({ data: modules.map(toModuleRow) })
  }

  async update(module: Module): Promise<void> {
    await this.db.module.update({ where: { id: module.id }, data: toModuleRow(module) })
  }

  async updateMany(modules: readonly Module[]): Promise<void> {
    await writeModules(this.db, modules, false)
  }

  async remove(id: string): Promise<void> {
    await this.db.module.deleteMany({ where: { id } })
  }

  async listOfBot(botId: string): Promise<Module[]> {
    const rows = await this.db.module.findMany({ where: { botId }, orderBy: { id: 'asc' } })
    return rows.map(toModuleEntity)
  }

  async listOfBots(botIds: readonly string[]): Promise<Module[]> {
    if (!botIds.length) {
      return []
    }
    const rows = await this.db.module.findMany({ where: { botId: { in: [...botIds] } }, orderBy: { id: 'asc' } })
    return rows.map(toModuleEntity)
  }

  async listBotIdsWithLiveScanner(): Promise<string[]> {
    const rows = await this.db.module.findMany({
      where: { type: 'scanner', props: { path: ['isLive'], equals: true } },
      select: { botId: true },
      distinct: ['botId'],
      orderBy: { botId: 'asc' }
    })
    return rows.map((row) => row.botId)
  }
}
