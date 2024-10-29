import { NextFunction, Request, Response } from 'express'
import { getLogger } from '../utils/logger'

const logger = getLogger('middlewares/logger')

export function loggerMiddleware(req: Request, _: Response, next: NextFunction) {
  logger.info(`${req.method}, ${req.url}`)
  next()
}
