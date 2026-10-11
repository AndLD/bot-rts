import { NextFunction, Request, Response } from 'express'
import { isDevelopment } from '../utils/constants'

export function createDevelopmentOnly(isEnabled: boolean) {
  return function developmentOnly(_: Request, res: Response, next: NextFunction) {
    return isEnabled ? next() : res.sendStatus(404)
  }
}

export const developmentOnly = createDevelopmentOnly(isDevelopment)
