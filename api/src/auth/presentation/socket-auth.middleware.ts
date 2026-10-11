import { Socket } from 'socket.io'
import { SOCKET_TOKEN_EXPIRED, SOCKET_UNAUTHORIZED } from '../../../../lib/utils/constants'
import { ErrorCode } from '../../../../lib/utils/error-codes'
import { Logger } from '../../shared/application/logger'
import { AppError } from '../../shared/domain/app-error'
import { AuthService, Principal } from '../application/auth.service'

declare module 'socket.io' {
  interface Socket {
    principal?: Principal
  }
}

type Next = (error?: Error) => void

// Socket.IO handshake authentication: the same access token and the same policy as the HTTP guard
export function createSocketAuthMiddleware(auth: Pick<AuthService, 'authenticate'>, logger: Logger) {
  return async function authenticateSocket(socket: Socket, next: Next) {
    const token = socket.handshake.auth.token || socket.handshake.query.token

    if (typeof token !== 'string' || !token) {
      return next(new Error(SOCKET_UNAUTHORIZED))
    }

    try {
      socket.principal = await auth.authenticate(token)
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
