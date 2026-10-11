import { NextFunction, Response } from 'express'
import { ForbiddenError } from '../src/shared/domain/errors'
import { isAdmin } from '../src/users/domain/user-access'
import { AuthorizedRequest } from './authorization'

export function hasOwnerStatus(req: AuthorizedRequest, _res: Response, next: NextFunction) {
  next(req.user?.status === 'owner' ? undefined : new ForbiddenError())
}

export function hasAdminStatus(req: AuthorizedRequest, _res: Response, next: NextFunction) {
  next(req.user && isAdmin(req.user.status) ? undefined : new ForbiddenError())
}
