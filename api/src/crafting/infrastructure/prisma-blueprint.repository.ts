import { Prisma } from '@prisma/client'
import { BlueprintSource } from '../../../../lib/utils/interfaces/crafting'
import { Clock } from '../../shared/application/clock'
import { BlueprintRepository } from '../application/blueprint.repository'
import { Blueprint } from '../domain/blueprint.entity'

export class PrismaBlueprintRepository implements BlueprintRepository {
  constructor(
    private readonly db: Prisma.TransactionClient,
    private readonly clock: Clock
  ) {}

  async add({ userId, module, source }: Blueprint): Promise<void> {
    await this.db.blueprint.createMany({
      data: [{ userId, module, source, learnedAt: this.clock.now() }],
      skipDuplicates: true
    })
  }

  async listOfUser(userId: string): Promise<Blueprint[]> {
    const rows = await this.db.blueprint.findMany({ where: { userId }, orderBy: { module: 'asc' } })
    return rows.map(({ module, source }) => ({ userId, module, source: source as BlueprintSource }))
  }
}
