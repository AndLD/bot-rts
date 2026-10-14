import { ICraftingBalance, IRecipe } from '../../../../lib/utils/interfaces/crafting'
import { IResourceStack } from '../../../../lib/utils/interfaces/resources'
import { fail, ResultCode } from '../../../../lib/utils/result'
import { ItemType } from '../../../../lib/utils/interfaces/items'
import { Item } from '../../crafting/domain/item.entity'
import { MapPoint } from '../../map/domain/map-point.entity'
import { RecipeBook } from '../../crafting/domain/recipe-book'
import { distanceBetween } from '../../modules/domain/weapon-module'
import { EnergyModel } from '../../modules/domain/energy-model'
import { GameModule } from '../../modules/domain/game-module'
import { Module } from '../../modules/domain/module.entity'
import { ModuleRegistry } from '../../modules/domain/module-registry'
import { RepairModule, scrapOf } from '../../modules/domain/repair-module'
import { depositStacks, withdrawStacks } from '../../modules/domain/storage-stock'
import { Repositories, UnitOfWork } from '../../persistence/application/unit-of-work'
import { Clock } from '../../shared/application/clock'
import { IdGenerator } from '../../shared/application/id-generator'
import { Rng } from '../../shared/application/rng'
import { NotFoundError, ValidationError } from '../../shared/domain/errors'
import { unwrap } from '../../shared/domain/result'
import { isCorpse } from '../domain/base-state'
import { Bot } from '../domain/bot.entity'
import { BaseLifecycle } from './base-lifecycle'
import { BotsService } from './bots.service'

// What taking a module apart yielded
export interface Disassembly {
  scrap: IResourceStack[]
  // Taking a module apart may also give away the blueprint of its class (design §9.3); a corpse base gives none
  blueprint: Item | null
}

export interface MaintenanceOrder {
  // The bot with the repair module, one of the player's
  repairerId: string
  // The bot whose module is worked on, on an adjacent cell; it may belong to anybody
  targetBotId: string
  moduleId: string
}

interface Job {
  repositories: Repositories
  targetPoint: MapPoint
  repairer: RepairModule
  repairerRecords: Module[]
  target: Bot
  targetRecords: Module[]
  module: GameModule
  recipe: IRecipe
}

// Repair and disassembly of the modules of a bot on an adjacent cell, by a bot with a repair module (design §8.4.2)
export class MaintenanceService {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly bots: BotsService,
    private readonly recipes: RecipeBook,
    private readonly registry: ModuleRegistry,
    private readonly energy: EnergyModel,
    private readonly clock: Clock,
    private readonly rng: Rng,
    private readonly lifecycle: BaseLifecycle,
    private readonly ids: IdGenerator
  ) {}

  // Restores some condition of the module, using up resources of the repairer's storage and energy. Repairing the
  // wireless adapter of a corpse base gives its owner control of it again; the one-living-base rule limits deploying,
  // not recovering a base.
  async repair(userId: string, order: MaintenanceOrder): Promise<Module> {
    const repairerBot = await this.bots.getControlledBot(userId, order.repairerId)

    return this.unitOfWork.run(async (repositories) => {
      const job = await this.prepare(repositories, repairerBot, order)
      const plan = unwrap(job.repairer.repair(job.module, job.recipe, this.now(), this.balance))
      const restored: Module = { ...job.module.record, condition: plan.condition }

      const paid = this.pay(job.repairerRecords, plan.cost, job.repairer.record.operationCost)
      await this.save(repositories, job.repairerRecords, this.replace(paid, job.repairer.withProps(plan.patch)))
      await repositories.modules.update(restored)
      await this.syncOwner(repositories, job.target)
      return restored
    })
  }

  // Takes the module apart: it disappears and a share of its recipe resources goes to the repairer's storage. Only a
  // broken module of another player's bot can be taken apart, or any module of an own bot.
  async disassemble(userId: string, order: MaintenanceOrder): Promise<Disassembly> {
    const repairerBot = await this.bots.getControlledBot(userId, order.repairerId)

    return this.unitOfWork.run(async (repositories) => {
      const job = await this.prepare(repositories, repairerBot, order)
      const owner = await this.ownerOf(repositories, job.target)
      const kept = unwrap(job.repairer.disassemble(job.module, owner === userId, this.now()))

      const scrap = scrapOf(job.recipe, this.rng.next(), this.recipes.balance)
      const stored = this.merge(job.repairerRecords, unwrap(depositStacks(job.repairerRecords, scrap)))
      const paid = unwrap(this.energy.spend(stored, job.repairer.record.operationCost))
      await this.save(repositories, job.repairerRecords, this.replace(paid, job.repairer.withProps(kept.patch)))
      await repositories.modules.remove(job.module.id)
      await this.retireIfEmpty(repositories, job.target, job.targetPoint)

      const blueprint = await this.lootBlueprint(repositories, job, repairerBot)
      await this.syncOwner(repositories, job.target)
      return { scrap, blueprint }
    })
  }

  private get balance(): ICraftingBalance {
    return this.recipes.balance
  }

  private now(): number {
    return this.clock.now().getTime()
  }

  // Checks everything the two operations have in common and loads what they work with
  private async prepare(repositories: Repositories, repairerBot: Bot, order: MaintenanceOrder): Promise<Job> {
    if (order.targetBotId === repairerBot.id) {
      throw new ValidationError('A bot cannot work on itself')
    }
    const target = await repositories.bots.findById(order.targetBotId)
    if (!target) {
      throw new NotFoundError('Target bot not found')
    }

    const from = await repositories.map.findPointByContentId(repairerBot.id)
    const to = await repositories.map.findPointByContentId(target.id)
    if (!from || !to) {
      throw new NotFoundError('Bot location not found')
    }
    if (distanceBetween(from.location, to.location) !== 1) {
      unwrap(fail(ResultCode.OUT_OF_RANGE, 'The target bot is not on an adjacent cell'))
    }

    const repairerRecords = await repositories.modules.listOfBot(repairerBot.id)
    const repairer = this.registry.instancesOf(repairerRecords, RepairModule).find((candidate) => candidate.isWorking)
    if (!repairer) {
      unwrap(fail(ResultCode.NO_MODULE, 'The bot has no working repair module'))
    }

    const targetRecords = await repositories.modules.listOfBot(target.id)
    const record = targetRecords.find((candidate) => candidate.id === order.moduleId)
    if (!record) {
      throw new NotFoundError('The target bot has no such module')
    }
    return {
      repositories,
      targetPoint: to,
      repairer: repairer as RepairModule,
      repairerRecords,
      target,
      targetRecords,
      module: this.registry.instantiate(record),
      recipe: this.recipes.get(record.name)
    }
  }

  // The player who owns the bot: a base through its `userId`, any other bot through its base
  private async ownerOf(repositories: Repositories, bot: Bot): Promise<string | null> {
    if (bot.userId) {
      return bot.userId
    }
    return bot.baseId ? ((await repositories.bots.findById(bot.baseId))?.userId ?? null) : null
  }

  // A bot whose last module is gone keeps its record, but its cell on the map is emptied and it only remembers where it
  // was (design §8.4.1)
  private async retireIfEmpty(repositories: Repositories, bot: Bot, point: MapPoint): Promise<void> {
    if (!(await repositories.modules.listOfBot(bot.id)).length) {
      await repositories.map.upsertPoint({ ...point, type: null, contentId: null })
      await repositories.bots.setLastPosition(bot.id, point.location)
    }
  }

  // The blueprint item of the module, by chance, carried by the bot that took it apart. A base its owner lost control
  // of is a corpse and gives none.
  private async lootBlueprint(repositories: Repositories, job: Job, repairerBot: Bot): Promise<Item | null> {
    const isCorpseBase = job.target.userId !== null && isCorpse(this.registry.instantiateAll(job.targetRecords))
    if (isCorpseBase || this.rng.next() >= this.balance.lootBlueprintChance) {
      return null
    }
    const item: Item = {
      id: this.ids.next(),
      type: ItemType.BLUEPRINT,
      name: job.module.name,
      weight: 0.1,
      botId: repairerBot.id
    }
    await repositories.items.add(item)
    return item
  }

  // Shows the owner's bases on the map as they are now (a base lost its adapter, or got control back)
  private async syncOwner(repositories: Repositories, target: Bot): Promise<void> {
    const owner = await this.ownerOf(repositories, target)
    if (owner) {
      await this.lifecycle.syncMapState(owner, repositories)
    }
  }

  // The records after the repairer paid resources and energy; throws when it cannot
  private pay(records: readonly Module[], cost: readonly IResourceStack[], energy: number): Module[] {
    const withdrawn = this.merge(records, unwrap(withdrawStacks(records, cost)))
    return unwrap(this.energy.spend(withdrawn, energy))
  }

  private merge(records: readonly Module[], changed: readonly Module[]): Module[] {
    return records.map((record) => changed.find((candidate) => candidate.id === record.id) ?? record)
  }

  private replace(records: readonly Module[], changed: Module): Module[] {
    return this.merge(records, [changed])
  }

  private async save(repositories: Repositories, before: readonly Module[], after: readonly Module[]): Promise<void> {
    await repositories.modules.updateMany(after.filter((candidate) => !before.includes(candidate)))
  }
}
