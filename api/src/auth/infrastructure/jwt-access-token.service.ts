import jwt from 'jsonwebtoken'
import { UnauthorizedError } from '../../shared/domain/errors'
import { AccessTokenClaims, AccessTokenService } from '../application/ports'
import { AccessTokenExpiredError } from '../domain/auth.errors'
import { isValidId } from '../../shared/domain/ids'

// Short-lived HS256 JWTs carrying only the user and the session; roles are never put in a token
export class JwtAccessTokenService implements AccessTokenService {
  constructor(
    private readonly secret: string,
    private readonly ttlSeconds: number
  ) {}

  sign({ userId, sessionId }: AccessTokenClaims): string {
    return jwt.sign({ sid: sessionId }, this.secret, {
      algorithm: 'HS256',
      subject: userId,
      expiresIn: this.ttlSeconds
    })
  }

  verify(token: string): AccessTokenClaims {
    try {
      const payload = jwt.verify(token, this.secret, { algorithms: ['HS256'] })

      if (typeof payload === 'string' || !isValidId(payload.sub) || !isValidId(payload.sid)) {
        throw new UnauthorizedError('The token is malformed')
      }

      return { userId: payload.sub, sessionId: payload.sid }
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new AccessTokenExpiredError()
      }

      throw error instanceof UnauthorizedError ? error : new UnauthorizedError('The token is invalid')
    }
  }
}
