import { Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { IUserPostBody } from '../../../lib/utils/interfaces/users'
import { parseUserIdFromEmailVerificationToken } from '../../src/auth/infrastructure/jwt-payload'
import { AppServices } from '../../src/legacy/legacy-services'
import { UnauthorizedError, ValidationError } from '../../src/shared/domain/errors'
import { toUserState } from '../../src/users/presentation/user.mapper'
import { apiUtils } from '../../utils/api'
import { createEmailVerificationJwt, createJwt, emailVerificationJwtSecret } from '../../utils/jwt'
import { getLogger } from '../../utils/logger'

const logger = getLogger('controllers/public/users')

export function createUsersPublicControllers({
  users,
  verificationMailer
}: Pick<AppServices, 'users' | 'verificationMailer'>) {
  return {
    async postUser(req: Request, res: Response) {
      const body: IUserPostBody = req.body
      const user = await users.register(body)
      const tokens = createJwt(toUserState(user))

      apiUtils.setRefreshTokenCookie(res, tokens.refreshToken)
      // The response does not wait for the mail server
      verificationMailer.send(user, createEmailVerificationJwt(user.id)).catch((error) => logger.error(error))

      res.json({ result: tokens.accessToken })
    },

    async getVerifyEmail(req: Request, res: Response) {
      const token = req.query.token

      if (typeof token !== 'string' || !token) {
        throw new ValidationError('Verification token is required')
      }

      let userId: string | undefined

      try {
        userId = parseUserIdFromEmailVerificationToken(
          jwt.verify(token, emailVerificationJwtSecret, { algorithms: ['HS256'] })
        )
      } catch {
        userId = undefined
      }
      if (!userId) {
        throw new UnauthorizedError('JWT invalid')
      }

      await users.activate(userId)

      res.sendStatus(200)
    }
  }
}
