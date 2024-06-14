import { ID } from '../types'

export interface IUser {
    _id: ID
    name: string
    email: string
    password: string
}
