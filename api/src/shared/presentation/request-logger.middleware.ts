import { NextFunction, Request, Response } from 'express'
import { Logger } from '../application/logger'

export function createRequestLogger(logger: Logger) {
  return function requestLogger(req: Request, _res: Response, next: NextFunction) {
    logger.info(`${req.method}, ${req.url}`)
    next()
  }
}
