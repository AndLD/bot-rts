import { BOT_TYPE } from '../../../../lib/utils/interfaces/bots'
import { BlueprintSource, MAX_CRAFT_COUNT } from '../../../../lib/utils/interfaces/crafting'
import { ItemType } from '../../../../lib/utils/interfaces/items'
import { fail, ResultCode } from '../../../../lib/utils/result'
import { AlreadyKnownError } from '../../crafting/domain/crafting.errors'
import { Blueprint } from '../../crafting/domain/blueprint.entity'
import { Item } from '../../crafting/domain/item.entity'
import { RecipeBook } from '../../crafting/domain/recipe-book'
import { ModuleFactory } from '../../modules/application/module.factory'
import { EnergyModel } from '../../modules/domain/energy-model'
import { FactoryJob, FactoryModule } from '../../modules/domain/game-module'
import { Module } from '../../modules/domain/module.entity'
import { ModuleRegistry } from '../../modules/domain/module-registry'
import { withdrawStacks } from '../../modules/domain/storage-stock'
import { Repositories, UnitOfWork } from '../../persistence/application/unit-of-work'
import { Clock } from '../../shared/application/clock'
import { IdGenerator } from '../../shared/application/id-generator'
import { NotFoundError, ValidationError } from '../../shared/domain/errors'
import { unwrap } from '../../shared/domain/result'
import { Bot } from '../domain/bot.entity'
import { BotsService } from './bots.service'

// What a base's factory holds for its owner
export interface FactoryStatus {
  // The game clock when the status was taken, in ms
  now: number
  jobs: FactoryJob[]
  // Finished module parts and blueprint items in the base's inventory
  parts: Item[]
  blueprintItems: Item[]
}

// The operations of the factory of a base: craft, research, learn (design §9.3). Every transport (HTTP, sockets, the
// terminal, later scripts) calls this one use case, so the rules are the same for all of them.
export class FactoryService {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly bots: BotsService,
    private readonly recipes: RecipeBook,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly registry: ModuleRegistry,
    private readonly energy: EnergyModel,
    private readonly moduleFactory: ModuleFactory
  ) {}

  async status(userId: string, baseId: string): Promise<FactoryStatus> {
    const base = await this.getBase(userId, baseId)

    return this.unitOfWork.run(async (repositories) => {
      const records = await this.settle(repositories, base)
      const items = await repositories.items.listOfBot(base.id)
      const carried = await this.carriedByBots(repositories, base)
      return {
        now: this.now(),
        jobs: this.factoryOf(records)?.jobs ?? [],
        parts: items.filter((item) => item.type === ItemType.PART),
        blueprintItems: [...items, ...carried].filter((item) => item.type === ItemType.BLUEPRINT)
      }
    })
  }

  // Orders `count` modules: their resources and the factory's energy are paid now, the modules are finished one after
  // the other as the factory works through its queue
  async craft(userId: string, baseId: string, module: string, count = 1): Promise<FactoryJob[]> {
    if (!Number.isInteger(count) || count < 1 || count > MAX_CRAFT_COUNT) {
      throw new ValidationError(`Craft between 1 and ${MAX_CRAFT_COUNT} modules at a time`)
    }
    const base = await this.getBase(userId, baseId)
    const recipe = this.recipes.get(module)

    return this.unitOfWork.run(async (repositories) => {
      const records = await this.settle(repositories, base)
      await this.requireKnown(repositories, userId, module)

      const pending = this.pay(
        records,
        recipe.resources.map(({ resource, amount }) => ({ resource, amount: amount * count })),
        count
      )
      const jobs: FactoryJob[] = []
      let factory = this.workingFactory(pending)
      for (let i = 0; i < count; i++) {
        const queued = unwrap(factory.enqueue({ kind: 'craft', module, durationMs: recipe.craftTimeMs }, this.now()))
        jobs.push(queued.job)
        factory = new FactoryModule(factory.withProps(queued.patch))
      }

      await this.save(repositories, records, this.merge(pending, [factory.record]))
      return jobs
    })
  }

  // Starts researching the blueprint of a higher class: it costs a multiple of the recipe and its time, and needs the
  // class below to be known
  async research(userId: string, baseId: string, module: string): Promise<FactoryJob> {
    const base = await this.getBase(userId, baseId)
    this.recipes.get(module)

    return this.unitOfWork.run(async (repositories) => {
      const records = await this.settle(repositories, base)
      const known = await this.knownModules(repositories, userId)
      if (known.has(module)) {
        throw new AlreadyKnownError(`You already know the blueprint of ${module}`)
      }
      const below = this.recipes.previousClass(module)
      if (!below || !known.has(below.module)) {
        unwrap(fail(ResultCode.NO_BLUEPRINT, 'Know the blueprint of the class below first'))
      }
      if (this.workingFactory(records).jobs.some((job) => job.kind === 'research' && job.module === module)) {
        throw new AlreadyKnownError(`${module} is already being researched`)
      }

      const cost = this.recipes.researchCost(module)
      const pending = this.pay(records, cost.resources, 1)
      const factory = this.workingFactory(pending)
      const queued = unwrap(factory.enqueue({ kind: 'research', module, durationMs: cost.timeMs }, this.now()))

      await this.save(repositories, records, this.merge(pending, [factory.withProps(queued.patch)]))
      return queued.job
    })
  }

  // Uses up a blueprint item of the base: the player knows that blueprint for good
  async learn(userId: string, baseId: string, itemId: string): Promise<Blueprint> {
    const base = await this.getBase(userId, baseId)

    return this.unitOfWork.run(async (repositories) => {
      const records = await this.settle(repositories, base)
      this.workingFactory(records)

      const item = await repositories.items.findById(itemId)
      const held = [...(await repositories.items.listOfBot(base.id)), ...(await this.carriedByBots(repositories, base))]
      if (!item || item.type !== ItemType.BLUEPRINT || !held.some((candidate) => candidate.id === item.id)) {
        throw new NotFoundError('The base and its bots hold no such blueprint')
      }
      this.recipes.get(item.name)
      if ((await this.knownModules(repositories, userId)).has(item.name)) {
        throw new AlreadyKnownError(`You already know the blueprint of ${item.name}`)
      }

      const blueprint: Blueprint = {
        userId,
        module: item.name,
        source: BlueprintSource.ITEM,
        learnedAt: this.clock.now()
      }
      await repositories.blueprints.add(blueprint)
      await repositories.items.remove(item.id)
      return blueprint
    })
  }

  // Finishes what is done by now, in a transaction of its own
  async settleBase(base: Bot): Promise<void> {
    await this.unitOfWork.run((repositories) => this.settle(repositories, base))
  }

  // Finishes the jobs that are done by now: crafted modules become parts in the base's inventory, researched
  // blueprints become known. Returns the base's module records afterwards.
  async settle(repositories: Repositories, base: Bot): Promise<Module[]> {
    const records = await repositories.modules.listOfBot(base.id)
    const factory = this.factoryOf(records)
    if (!factory) {
      return records
    }

    const { done, patch } = factory.settle(this.now())
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

  // The items carried by the ordinary bots of the base: a blueprint a bot found or looted can be learned at the factory
  // over the radio link until bots can bring items home (phase 5)
  private async carriedByBots(repositories: Repositories, base: Bot): Promise<Item[]> {
    const bots = await repositories.bots.listOfBase(base.id)
    return (await Promise.all(bots.map((bot) => repositories.items.listOfBot(bot.id)))).flat()
  }

  private async getBase(userId: string, baseId: string): Promise<Bot> {
    const base = await this.bots.getControlledBot(userId, baseId)
    if (base.type !== BOT_TYPE.BASE) {
      throw new ValidationError('The factory is on a base')
    }
    return base
  }

  private now(): number {
    return this.clock.now().getTime()
  }

  private factoryOf(records: readonly Module[]): FactoryModule | undefined {
    return this.registry.instancesOf(records, FactoryModule).find((factory) => factory.isWorking)
  }

  // The first working factory of the base, or NO_MODULE
  private workingFactory(records: readonly Module[]): FactoryModule {
    const factory = this.factoryOf(records)
    if (!factory) {
      unwrap(fail(ResultCode.NO_MODULE, 'The base has no working factory'))
    }
    return factory as FactoryModule
  }

  private async knownModules(repositories: Repositories, userId: string): Promise<Set<string>> {
    const learned = (await repositories.blueprints.listOfUser(userId)).map((blueprint) => blueprint.module)
    return this.recipes.known(learned)
  }

  private async requireKnown(repositories: Repositories, userId: string, module: string): Promise<void> {
    if (!(await this.knownModules(repositories, userId)).has(module)) {
      unwrap(fail(ResultCode.NO_BLUEPRINT, `You do not know the blueprint of ${module}`))
    }
  }

  // The records after the factory took its resources and `operations` times its energy cost; throws when short
  private pay(records: readonly Module[], stacks: Parameters<typeof withdrawStacks>[1], operations: number): Module[] {
    const factory = this.workingFactory(records)
    const withdrawn = this.merge(records, unwrap(withdrawStacks(records, stacks)))
    return unwrap(this.energy.spend(withdrawn, factory.record.operationCost * operations))
  }

  private merge(records: readonly Module[], changed: readonly Module[]): Module[] {
    return records.map((record) => changed.find((candidate) => candidate.id === record.id) ?? record)
  }

  // Writes the records that changed since `before`
  private async save(repositories: Repositories, before: readonly Module[], after: readonly Module[]): Promise<void> {
    for (const record of after.filter((candidate) => !before.includes(candidate))) {
      await repositories.modules.update(record)
    }
  }
}
