import { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { Socket } from 'socket.io'
import { ExtendedError } from 'socket.io/dist/namespace'
import { IUserState } from '../../lib/utils/interfaces/users'
import { SOCKET_TOKEN_EXPIRED, SOCKET_UNAUTHORIZED } from '../../lib/utils/constants'
import { parseUserIdFromSessionToken } from '../src/auth/infrastructure/jwt-payload'
import { UnauthorizedError } from '../src/shared/domain/errors'
import { User } from '../src/users/domain/user.entity'
import { toUserState } from '../src/users/presentation/user.mapper'
import { accessJwtSecret } from '../utils/jwt'
import { getLogger } from '../utils/logger'

const logger = getLogger('middlewares/authorization')

declare module 'socket.io' {
  interface Socket {
    user?: IUserState
  }
}

export interface UserSource {
  getUsableUser(id: string): Promise<User>
}

export interface AuthorizedRequest extends Request {
  user?: IUserState
}

async function authenticate(users: UserSource, token: string | undefined): Promise<IUserState> {
  const payload = jwt.verify(token as string, accessJwtSecret, { algorithms: ['HS256'] })
  const userId = parseUserIdFromSessionToken(payload)

  if (!userId) {
    throw new UnauthorizedError('JWT invalid')
  }

  // Role, ban and verification state always come from the store, never from the token
  return toUserState(await users.getUsableUser(userId))
}

export function createIsAuthorized(users: UserSource) {
  return async function isAuthorized(req: AuthorizedRequest, _res: Response, next: NextFunction) {
    if (!req.headers.authorization) {
      return next(new UnauthorizedError('Authorization header is empty'))
    }

    try {
      req.user = await authenticate(users, req.headers.authorization.split(' ')[1])
    } catch (error) {
      return next(error instanceof jwt.JsonWebTokenError ? new UnauthorizedError('JWT invalid') : error)
    }

    next()
  }
}

export function createIsSocketAuthorized(users: UserSource) {
  return async function isSocketAuthorized(socket: Socket, next: (err?: ExtendedError) => void) {
    const accessToken = socket.handshake.auth.token || socket.handshake.query.token

    if (typeof accessToken !== 'string' || !accessToken) {
      return next(new Error(SOCKET_UNAUTHORIZED))
    }

    try {
      socket.user = await authenticate(users, accessToken)
      return next()
    } catch (err) {
      if ((err as Error).name === 'TokenExpiredError') {
        return next(new Error(SOCKET_TOKEN_EXPIRED))
      }

      logger.warn(`Socket handshake rejected: ${(err as Error).message}`)
      return next(new Error(SOCKET_UNAUTHORIZED))
    }
  }
}
