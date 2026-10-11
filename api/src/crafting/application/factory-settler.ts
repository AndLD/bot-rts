import { BOT_TYPE } from '../../../../lib/utils/interfaces/bots'
import { BlueprintSource } from '../../../../lib/utils/interfaces/crafting'
import { ItemType } from '../../../../lib/utils/interfaces/items'
import { ModuleFactory } from '../../modules/application/module.factory'
import { FactoryModule } from '../../modules/domain/game-module'
import { Module } from '../../modules/domain/module.entity'
import { ModuleRegistry } from '../../modules/domain/module-registry'
import { Repositories, UnitOfWork } from '../../persistence/application/unit-of-work'
import { Clock } from '../../shared/application/clock'
import { IdGenerator } from '../../shared/application/id-generator'

// Finishes the jobs of a factory that are done by now: crafted modules become parts in the inventory of the base,
// researched blueprints become known to its owner. There is no scheduler yet (the engine arrives in phase 5), so
// whoever looks at a factory settles it first.
export class FactorySettler {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly registry: ModuleRegistry,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly moduleFactory: ModuleFactory
  ) {}

  // The first working factory among the records
  factoryOf(records: readonly Module[]): FactoryModule | undefined {
    return this.registry.instancesOf(records, FactoryModule).find((factory) => factory.isWorking)
  }

  // Settles the factory of one base inside the given transaction; returns the base's module records afterwards
  async settle(repositories: Repositories, base: { id: string; userId: string | null }): Promise<Module[]> {
    const records = await repositories.modules.listOfBot(base.id)
    const factory = this.factoryOf(records)
    if (!factory) {
      return records
    }

    const { done, patch } = factory.settle(this.clock.now().getTime())
    for (const job of done) {
      if (job.kind === 'craft') {
        await repositories.items.add({
          id: this.ids.next(),
          type: ItemType.PART,
          name: job.module,
          weight: this.moduleFactory.template(job.module).weight,
          botId: base.id
        })
      } else {
        await repositories.blueprints.add({
          userId: base.userId as string,
          module: job.module,
          source: BlueprintSource.RESEARCH,
          learnedAt: new Date(job.readyAt)
        })
      }
    }
    if (!done.length) {
      return records
    }
    const settled = factory.withProps(patch)
    await repositories.modules.update(settled)
    return records.map((record) => (record.id === settled.id ? settled : record))
  }

  // Settles every base of a player, in a transaction of its own
  async settleUser(userId: string): Promise<void> {
    await this.unitOfWork.run(async (repositories) => {
      for (const base of await repositories.bots.listOfUser(userId, { type: BOT_TYPE.BASE })) {
        await this.settle(repositories, base)
      }
    })
  }
}
