import { Prisma } from '@prisma/client'
import { BlueprintSource } from '../../../../lib/utils/interfaces/crafting'
import { BlueprintRepository } from '../application/blueprint.repository'
import { Blueprint } from '../domain/blueprint.entity'

export class PrismaBlueprintRepository implements BlueprintRepository {
  constructor(private readonly db: Prisma.TransactionClient) {}

  async add(blueprint: Blueprint): Promise<void> {
    await this.db.blueprint.createMany({ data: [blueprint], skipDuplicates: true })
  }

  async listOfUser(userId: string): Promise<Blueprint[]> {
    const rows = await this.db.blueprint.findMany({ where: { userId }, orderBy: { module: 'asc' } })
    return rows.map((row) => ({ ...row, source: row.source as BlueprintSource }))
  }
}
