import { MapPointType } from '../../../../lib/utils/interfaces/map'
import { IResourceStack } from '../../../../lib/utils/interfaces/resources'

export interface Location {
  readonly x: number
  readonly y: number
  readonly z: number
}

export interface LocationRange {
  readonly from: Location
  readonly to: Location
}

// A cell of the real (authoritative) layer
export interface MapPoint {
  readonly id: string
  readonly location: Location
  readonly type: MapPointType | null
  readonly contentId: string | null
  // The deposit of a resource cell (its amount is the fixed amount left, design §9.1)
  readonly resource: IResourceStack | null
}

// A cell as one player knows it: a snapshot taken at game tick `seenAt` (design §4.2)
export interface KnownPoint extends MapPoint {
  readonly userId: string
  readonly seenAt: number
}
