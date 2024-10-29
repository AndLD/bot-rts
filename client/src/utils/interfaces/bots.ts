import { ID } from '../types'

export interface IBot {
    _id: ID
    label?: string
    userId?: string
}

export interface IPostBot {
    _id?: ID
    label?: string
    userId?: string
}
