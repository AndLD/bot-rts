import { ID } from '../types'

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
}
