import { NextFunction, Response } from 'express'
import { usersService } from '../services/users'
import { apiUtils } from '../utils/api'
import { errors } from '../utils/constants'
import { createIsAuthorized, createIsSocketAuthorized } from './authorization'

export const isAuthorized = createIsAuthorized(usersService)
export const isSocketAuthorized = createIsSocketAuthorized(usersService)

export function hasOwnerStatus(req: any, res: Response, next: NextFunction) {
  if (req.user?.status === 'owner') {
    return next()
  }

  return apiUtils.sendError(res, errors.FORBIDDEN)
}

export function hasAdminStatus(req: any, res: Response, next: NextFunction) {
  if (req.user?.status === 'admin' || req.user?.status === 'owner') {
    return next()
  }

  return apiUtils.sendError(res, errors.FORBIDDEN)
}
