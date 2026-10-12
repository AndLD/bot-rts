import { Item as ItemRow, Prisma } from '@prisma/client'
import { ItemType } from '../../../../lib/utils/interfaces/items'
import { ItemRepository } from '../application/item.repository'
import { Item } from '../domain/item.entity'

function toItem(row: ItemRow): Item {
  return { ...row, type: row.type as ItemType }
}

export class PrismaItemRepository implements ItemRepository {
  constructor(private readonly db: Prisma.TransactionClient) {}

  async add(item: Item): Promise<void> {
    await this.db.item.create({ data: item })
  }

  async findById(id: string): Promise<Item | null> {
    const row = await this.db.item.findUnique({ where: { id } })
    return row && toItem(row)
  }

  async listByIds(ids: readonly string[]): Promise<Item[]> {
    return (await this.db.item.findMany({ where: { id: { in: [...ids] } }, orderBy: { id: 'asc' } })).map(toItem)
  }

  async listOfBot(botId: string): Promise<Item[]> {
    return (await this.db.item.findMany({ where: { botId }, orderBy: { id: 'asc' } })).map(toItem)
  }

  async remove(id: string): Promise<void> {
    await this.db.item.deleteMany({ where: { id } })
  }
}
