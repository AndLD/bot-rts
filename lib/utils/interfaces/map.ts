import { ID } from '../types'
import { IResourceStack } from './resources'

export enum MapPointType {
  RESOURCE = 'resource',
  BOT = 'bot',
  ITEM = 'item',
  BASE = 'base',
  // A base its owner lost control of (design §6.3)
  CORPSE_BASE = 'corpse_base'
}

export type Location = { x: number; y: number; z?: number }

// If userId is not specified, then the point relates to the general game map
export interface IMapPoint {
  _id: ID
  location: Location
  userId?: ID
  contentId: ID | null
  type: MapPointType | null
  // What a resource cell holds and how much of it is left
  resource?: IResourceStack
  // Game tick at which a player's snapshot of the cell was taken (known cells only)
  seenAt?: number
}
