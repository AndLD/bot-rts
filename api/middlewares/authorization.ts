import { NextFunction, Request, Response } from 'express'
import { Socket } from 'socket.io'
import { ExtendedError } from 'socket.io/dist/namespace'
import { IUserState } from '../../lib/utils/interfaces/users'
import { SOCKET_TOKEN_EXPIRED, SOCKET_UNAUTHORIZED } from '../../lib/utils/constants'
import { ErrorCode } from '../../lib/utils/error-codes'
import { AuthService } from '../src/auth/application/auth.service'
import { readBearerToken } from '../src/auth/presentation/auth.guard'
import { AppError } from '../src/shared/domain/app-error'
import { UnauthorizedError } from '../src/shared/domain/errors'
import { toUserState } from '../src/users/presentation/user.mapper'
import { getLogger } from '../utils/logger'

const logger = getLogger('middlewares/authorization')

declare module 'socket.io' {
  interface Socket {
    user?: IUserState
  }
}

export type TokenAuthenticator = Pick<AuthService, 'authenticate'>

export interface AuthorizedRequest extends Request {
  user?: IUserState
}

async function authenticate(auth: TokenAuthenticator, token: string): Promise<IUserState> {
  const { user, identity } = await auth.authenticate(token)

  return toUserState(user, identity.emailVerified)
}

export function createIsAuthorized(auth: TokenAuthenticator) {
  return async function isAuthorized(req: AuthorizedRequest, _res: Response, next: NextFunction) {
    const token = readBearerToken(req.headers.authorization)

    if (!token) {
      return next(new UnauthorizedError('Authorization header is empty'))
    }

    try {
      req.user = await authenticate(auth, token)
    } catch (error) {
      return next(error)
    }

    next()
  }
}

export function createIsSocketAuthorized(auth: TokenAuthenticator) {
  return async function isSocketAuthorized(socket: Socket, next: (err?: ExtendedError) => void) {
    const accessToken = socket.handshake.auth.token || socket.handshake.query.token

    if (typeof accessToken !== 'string' || !accessToken) {
      return next(new Error(SOCKET_UNAUTHORIZED))
    }

    try {
      socket.user = await authenticate(auth, accessToken)
      return next()
    } catch (error) {
      if (error instanceof AppError && error.code === ErrorCode.TOKEN_EXPIRED) {
        return next(new Error(SOCKET_TOKEN_EXPIRED))
      }

      logger.warn(`Socket handshake rejected: ${(error as Error).message}`)
      return next(new Error(SOCKET_UNAUTHORIZED))
    }
  }
}
