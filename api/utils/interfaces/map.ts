import { ID } from '../types'

export type MapPointType = 'resource' | 'bot' | 'item' | 'module'

// If userId is not specified, then the point relates to the general game map
export interface IMapPoint {
    _id: ID
    x: number
    y: number
    z?: number
    userId?: ID
    contentId: ID | null
    type: MapPointType
}
