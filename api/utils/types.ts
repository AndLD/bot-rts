import { NextFunction, Request, Response } from 'express'
import { IUserState } from '@lib/utils/interfaces/users'

export type Controller = (req: Request, res: Response, next?: NextFunction) => any

export interface AuthorizedRequest extends Request {
  user?: IUserState
  middlewarePayload?: {
    [key: string]: any
  }
}
