import { Item } from '../domain/item.entity'

export const ITEM_REPOSITORY = Symbol('ItemRepository')

export interface ItemRepository {
  add(item: Item): Promise<void>
  findById(id: string): Promise<Item | null>
  listOfBot(botId: string): Promise<Item[]>
  remove(id: string): Promise<void>
}
