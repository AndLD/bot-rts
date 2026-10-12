import { ID } from '../types'
import { IMapPoint, Location } from './map'
import { IItem } from './items'
import { ModuleProps } from './modules'
import { IResourceStack } from './resources'

export enum BOT_TYPE {
  BASE = 'base',
  // An ordinary bot, owned by a base
  WORKER = 'worker'
}

export interface IBot {
  _id: ID
  label?: string
  // Only a base has `userId`; any other bot has `baseId` (design §8.1)
  userId?: string
  baseId?: string
  type: BOT_TYPE
  // Set when all modules of the bot were taken apart: the bot has no cell on the map, only this last place
  lastPosition?: Location
}

// A new bot with its modules and its place on the map
export interface IBotWithModules {
  bot: IBot
  modules: ModuleProps[]
  mapPoint: IMapPoint
}

// What a bot carries (design §9): resources in its storage modules and items in its manipulators
export interface IBotStorage {
  // Of the working storage modules
  capacity: number
  used: number
  resources: IResourceStack[]
  // Items the bot holds, in the order it picked them up
  items: IItem[]
  carriedWeight: number
  // What the working manipulators can carry together
  loadCapacity: number
}
