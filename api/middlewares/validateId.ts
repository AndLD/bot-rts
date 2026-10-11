import { NextFunction, Request, Response } from 'express'
import { apiUtils } from '../utils/api'
import { errors } from '../utils/constants'
import { isValidId } from '../utils/objectId'

export function validateIdParam(param: string) {
  return function validateId(req: Request, res: Response, next: NextFunction) {
    return isValidId(req.params[param]) ? next() : apiUtils.sendError(res, errors.INVALID_ID)
  }
}
