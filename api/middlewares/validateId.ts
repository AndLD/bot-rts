import { NextFunction, Request, Response } from 'express'
import { ValidationError } from '../src/shared/domain/errors'
import { isValidId } from '../src/shared/domain/ids'

export function validateIdParam(param: string) {
  return function validateId(req: Request, _res: Response, next: NextFunction) {
    next(isValidId(req.params[param]) ? undefined : new ValidationError('Invalid id'))
  }
}
