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

// The way a bot faces, as a quarter turn from north (0), clockwise: east is 1, south 2, west 3. North is toward smaller y.
export type Heading = 0 | 1 | 2 | 3

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

export type MapChassis = 'wheels' | 'tracks' | 'immobile'
export type MapModuleIcon = 'weapon' | 'drill' | 'scanner' | 'antenna'
export type MapItemKind = 'blueprint' | 'ammunition' | 'part' | 'generic'

// A cell of the map as a player sees it, with what the renderer needs to draw it (design §4.3). Cells the player never
// saw are not sent: they are the fog of war.
export interface IMapCell {
  x: number
  y: number
  type: MapPointType | null
  contentId: ID | null
  // The time of the snapshot, in ms of game time
  seenAt: number
  resource?: IResourceStack
  // What a resource cell held when generated, to show how much is left
  capacity?: number
  // Set on bots and bases: whether they are the player's
  isOwn?: boolean
  chassis?: MapChassis
  icons?: MapModuleIcon[]
  isDamaged?: boolean
  item?: MapItemKind
}

// A square the player's scanners keep live (design §4.4)
export interface ILiveArea {
  scannerId: ID
  botId: ID
  x: number
  y: number
  radius: number
}

// The largest side of a map range that can be asked for at once
export const MAP_VIEW_MAX_SIDE = 96

export interface IMapRange {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export interface IMapView {
  // The game time of the server, in ms
  now: number
  cells: IMapCell[]
  liveAreas: ILiveArea[]
}

// Pushed to the player when cells of their map change
export interface IMapUpdate {
  now: number
  cells: IMapCell[]
}

// A change of the radio signal of one of the player's bots (design §11.2.1); bars go from 0 to 4
export interface IRadioChange {
  botId: ID
  isConnected: boolean
  bars: number
  hops: number
}
