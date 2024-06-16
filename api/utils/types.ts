import { NextFunction, Request, Response } from 'express'
import { ObjectId } from 'mongodb'
import { IUserState } from './interfaces/users'

export type ID = string | ObjectId

export type Error = {
    msg: string
    code: number
}

export interface AuthorizedRequest extends Request {
    user?: IUserState
    middlewarePayload?: {
        [key: string]: any
    }
}

export type Controller = (req: Request, res: Response, next?: NextFunction) => any

export type Item = any
export type ItemType = Resource

export type Resource = Ore | Fluid
export type Ore = 'ironOre' | 'goldOre'
export type Fluid = 'water' | 'rawOil' | 'oil'
export type Material = 'iron' | 'gold' | 'aluminium'
