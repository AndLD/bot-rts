import { ItemType } from '../../../../lib/utils/interfaces/items'

// A discrete object (design §9.1). A blueprint item's `name` is the module it holds the blueprint of. It lies on the
// map (a map point of type item points at it) or is carried by a bot, never both.
export interface Item {
  readonly id: string
  readonly type: ItemType
  readonly name: string
  // kg
  readonly weight: number
  readonly botId: string | null
}
