import { BOT_TYPE } from '../../../../lib/utils/interfaces/bots'
import { ItemType } from '../../../../lib/utils/interfaces/items'
import { fail, ResultCode } from '../../../../lib/utils/result'
import { ItemRepository } from '../../crafting/application/item.repository'
import { ModuleFactory } from '../../modules/application/module.factory'
import { ModuleRepository } from '../../modules/application/module.repository'
import { FactoryModule } from '../../modules/domain/game-module'
import { ModuleRegistry } from '../../modules/domain/module-registry'
import { NotFoundError, ValidationError } from '../../shared/domain/errors'
import { unwrap } from '../../shared/domain/result'
import { validateAssembly } from '../domain/assembly'
import { MovementBalance, DEFAULT_MOVEMENT_BALANCE } from '../domain/movement'
import { BotsService } from './bots.service'

// Assembling a bot at the factory of a base from the module parts it holds (design §8.2, §9.3)
export class AssemblyService {
  constructor(
    private readonly bots: BotsService,
    private readonly modules: ModuleRepository,
    private readonly items: ItemRepository,
    private readonly moduleFactory: ModuleFactory,
    private readonly registry: ModuleRegistry,
    private readonly balance: MovementBalance = DEFAULT_MOVEMENT_BALANCE
  ) {}

  // The parts become the modules of a new bot, which appears next to the base. Needs a working factory on the base and
  // parts of that base; the modules must make a legal bot, otherwise nothing is used up.
  async assemble(userId: string, input: { baseId: string; label: string | null; partIds: readonly string[] }) {
    const base = await this.bots.getControlledBot(userId, input.baseId)
    if (base.type !== BOT_TYPE.BASE) {
      throw new ValidationError('A bot belongs to a base, not to another bot')
    }

    const factories = this.registry.instancesOf(await this.modules.listOfBot(base.id), FactoryModule)
    if (!factories.some((factory) => factory.isWorking)) {
      unwrap(fail(ResultCode.NO_MODULE, 'The base has no working factory'))
    }

    if (new Set(input.partIds).size !== input.partIds.length) {
      throw new ValidationError('A part can be used once')
    }
    const held = await this.items.listOfBot(base.id)
    const parts = input.partIds.map((id) => {
      const part = held.find((item) => item.id === id && item.type === ItemType.PART)
      if (!part) {
        throw new NotFoundError(`The base holds no part ${id}`)
      }
      return part
    })

    const templates = parts.map((part) => this.moduleFactory.template(part.name))
    const drafts = templates.map((template) => this.registry.instantiate({ ...template, id: 'draft', botId: 'draft' }))
    unwrap(validateAssembly(drafts, this.balance))

    return this.bots.createBot(userId, {
      baseId: base.id,
      label: input.label,
      modules: templates,
      consumedItemIds: input.partIds
    })
  }
}
