import { IResourceStack, RESOURCES } from '../../../../lib/utils/interfaces/resources'
import { ItemRepository } from '../../crafting/application/item.repository'
import { Item } from '../../crafting/domain/item.entity'
import { ManipulatorModule, StorageModule } from '../../modules/domain/game-module'
import { BotsService } from './bots.service'

// What a bot carries, for the storage window (design §9)
export interface BotStorage {
  capacity: number
  used: number
  resources: IResourceStack[]
  items: Item[]
  carriedWeight: number
  loadCapacity: number
}

export class StorageViewService {
  constructor(
    private readonly bots: BotsService,
    private readonly items: ItemRepository
  ) {}

  async of(userId: string, botId: string): Promise<BotStorage> {
    const records = await this.bots.getBotModules(userId, botId)
    const storages = records.filter((record) => record.type === 'storage').map((record) => new StorageModule(record))
    const hands = records
      .filter((record) => record.type === 'manipulator')
      .map((record) => new ManipulatorModule(record))
    const working = storages.filter((storage) => storage.isWorking)
    const held = await this.items.listOfBot(botId)

    return {
      capacity: working.reduce((sum, storage) => sum + storage.capacity, 0),
      used: working.reduce((sum, storage) => sum + storage.used, 0),
      resources: RESOURCES.map((resource) => ({
        resource,
        amount: storages.reduce((sum, storage) => sum + storage.amountOf(resource), 0)
      })).filter((stack) => stack.amount > 0),
      items: held,
      carriedWeight: held.reduce((sum, item) => sum + item.weight, 0),
      loadCapacity: hands.filter((hand) => hand.isWorking).reduce((sum, hand) => sum + hand.loadCapacity, 0)
    }
  }
}
