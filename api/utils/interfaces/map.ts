import { ID } from '../types'

export type MapPointType = 'resource' | 'bot' | 'item' | 'base'

export type Location = { x: number; y: number; z?: number }

// If userId is not specified, then the point relates to the general game map
export interface IMapPoint {
  _id: ID
  location: Location
  userId?: ID
  contentId: ID | null
  type: MapPointType | null
}

export interface IPostMapPoint {
  location: Location
  userId?: ID
  contentId: ID | null
  type: MapPointType | null
}
