import { ID } from '../types'
import { IMapPoint, Location } from './map'
import { ModuleProps } from './modules'

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
