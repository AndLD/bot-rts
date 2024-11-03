import { ID } from '../types'

export enum BOT_TYPE {
  BASE = 'base'
}
// export type BOT_TYPE = string

export interface IBot {
  _id: ID
  label?: string
  userId?: string
  type: BOT_TYPE
}

export interface IPostBot {
  _id?: ID
  label?: string
  userId?: string
  type: BOT_TYPE
}
