import { ID } from '../types'

export enum MapPointType {
  RESOURCE = 'resource',
  BOT = 'bot',
  ITEM = 'item',
  BASE = 'base'
}

export type Location = { x: number; y: number; z?: number }

// If userId is not specified, then the point relates to the general game map
export interface IMapPoint {
  _id: ID
  location: Location
  userId?: ID
  contentId: ID | null
  type: MapPointType | null
  // Game tick at which a player's snapshot of the cell was taken (known cells only)
  seenAt?: number
}
