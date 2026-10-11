import { NextFunction, Response } from 'express'
import jwt from 'jsonwebtoken'
import { Socket } from 'socket.io'
import { ExtendedError } from 'socket.io/dist/namespace'
import { IUser, IUserState } from '@lib/utils/interfaces/users'
import { SOCKET_TOKEN_EXPIRED, SOCKET_UNAUTHORIZED } from '../../lib/utils/constants'
import { apiUtils } from '../utils/api'
import { errors } from '../utils/constants'
import { accessJwtSecret } from '../utils/jwt'
import { parseUserIdFromSessionToken } from '../utils/jwtPayload'
import { getLogger } from '../utils/logger'
import { AuthorizedRequest } from '../utils/types'
import { getAccessDenial, toUserState } from '../utils/userAccess'

const logger = getLogger('middlewares/authorization')

declare module 'socket.io' {
  interface Socket {
    user?: IUserState
  }
}

export interface UserSource {
  findUserById(id: string): Promise<IUser | null>
}

type AuthenticationResult = { user: IUserState } | { error: typeof errors.JWT_INVALID }

async function authenticate(users: UserSource, token: string | undefined): Promise<AuthenticationResult> {
  const payload = jwt.verify(token as string, accessJwtSecret, { algorithms: ['HS256'] })
  const userId = parseUserIdFromSessionToken(payload)

  if (!userId) {
    return { error: errors.JWT_INVALID }
  }

  // Role, ban and verification state always come from the database, never from the token
  const user = await users.findUserById(userId)
  const denial = getAccessDenial(user)

  return denial ? { error: denial } : { user: toUserState(user as IUser) }
}

export function createIsAuthorized(users: UserSource) {
  return async function isAuthorized(req: AuthorizedRequest, res: Response, next: NextFunction) {
    if (!req.headers.authorization) {
      return apiUtils.sendError(res, errors.AUTHORIZATION_HEADER_EMPTY)
    }

    try {
      const result = await authenticate(users, req.headers.authorization.split(' ')[1])

      if ('error' in result) {
        return apiUtils.sendError(res, result.error)
      }

      req.user = result.user
    } catch (e) {
      logger.error(e)
      return apiUtils.sendError(res, errors.JWT_INVALID)
    }

    next()
  }
}

export function createIsSocketAuthorized(users: UserSource) {
  return async function isSocketAuthorized(socket: Socket, next: (err?: ExtendedError) => void) {
    const accessToken = socket.handshake.auth?.token || socket.handshake.query?.token

    if (typeof accessToken !== 'string' || !accessToken) {
      return next(new Error(SOCKET_UNAUTHORIZED))
    }

    try {
      const result = await authenticate(users, accessToken)

      if ('error' in result) {
        return next(new Error(SOCKET_UNAUTHORIZED))
      }

      socket.user = result.user
      return next()
    } catch (err) {
      if ((err as Error).name === 'TokenExpiredError') {
        return next(new Error(SOCKET_TOKEN_EXPIRED))
      }

      logger.error(err)
      return next(new Error(SOCKET_UNAUTHORIZED))
    }
  }
}
