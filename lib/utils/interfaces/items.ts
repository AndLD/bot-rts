import { ID } from '../types'

// A discrete object that can be picked up, carried, dropped and stored (design §9.1)
export enum ItemType {
  BLUEPRINT = 'blueprint',
  AMMUNITION = 'ammunition',
  PART = 'part'
}

export interface IItem {
  _id: ID
  type: ItemType
  name: string
  // kg
  weight: number
}
