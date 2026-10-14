import { IResourceStack } from '../../../../lib/utils/interfaces/resources'
import { ModuleRepository } from '../../modules/application/module.repository'
import { depositStacks, withdrawStacks } from '../../modules/domain/storage-stock'
import { UnitOfWork } from '../../persistence/application/unit-of-work'
import { NotFoundError, ValidationError } from '../../shared/domain/errors'

// What an admin does to a player's bot to put right a loss or a mistake (design §25.3, Supervision). These are world actions: the
// engine runs them between ticks, since it is the only writer of the world, and the console never calls them directly.
export class SupportService {
  constructor(private readonly unitOfWork: UnitOfWork) {}

  // Puts the stacks into the storages of the bot; all or nothing
  async grantResources(botId: string, stacks: IResourceStack[]): Promise<void> {
    await this.unitOfWork.run(async ({ modules }) => {
      const result = depositStacks(await this.modulesOf(modules, botId), stacks)

      if (!result.ok) {
        throw new ValidationError(result.msg)
      }
      await modules.updateMany(result.data)
    })
  }

  // Takes the stacks out of the storages of the bot; all or nothing
  async removeResources(botId: string, stacks: IResourceStack[]): Promise<void> {
    await this.unitOfWork.run(async ({ modules }) => {
      const result = withdrawStacks(await this.modulesOf(modules, botId), stacks)

      if (!result.ok) {
        throw new ValidationError(result.msg)
      }
      await modules.updateMany(result.data)
    })
  }

  // A module that was damaged or broken is whole again
  async restoreModule(botId: string, moduleId: string): Promise<void> {
    await this.unitOfWork.run(async ({ modules }) => {
      const module = (await this.modulesOf(modules, botId)).find((candidate) => candidate.id === moduleId)

      if (!module) {
        throw new NotFoundError('Module not found on this bot')
      }
      await modules.update({ ...module, condition: module.maxCondition })
    })
  }

  private async modulesOf(modules: ModuleRepository, botId: string) {
    const records = await modules.listOfBot(botId)

    if (!records.length) {
      throw new NotFoundError('Bot not found')
    }

    return records
  }
}
