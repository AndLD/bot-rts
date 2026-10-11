import { Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { IAuthPostBody } from '../../../lib/utils/interfaces/auth'
import { parseUserIdFromSessionToken } from '../../src/auth/infrastructure/jwt-payload'
import { AppServices } from '../../src/legacy/legacy-services'
import { UnauthorizedError } from '../../src/shared/domain/errors'
import { toUserState } from '../../src/users/presentation/user.mapper'
import { User } from '../../src/users/domain/user.entity'
import { apiUtils } from '../../utils/api'
import { createJwt, refreshJwtSecret } from '../../utils/jwt'

function issueTokens(res: Response, user: User) {
  const tokens = createJwt(toUserState(user))

  apiUtils.setRefreshTokenCookie(res, tokens.refreshToken)

  return tokens.accessToken
}

export function createAuthPublicControllers({ users }: Pick<AppServices, 'users'>) {
  return {
    async postLogin(req: Request, res: Response) {
      const body: IAuthPostBody = req.body
      const user = await users.authenticate(body.email, body.password)

      res.json({ result: issueTokens(res, user) })
    },

    async getRefresh(req: Request, res: Response) {
      const refreshToken = req.cookies.refreshToken
      let userId: string | undefined

      try {
        userId = refreshToken
          ? parseUserIdFromSessionToken(jwt.verify(refreshToken, refreshJwtSecret, { algorithms: ['HS256'] }))
          : undefined
      } catch {
        userId = undefined
      }
      if (!userId) {
        throw new UnauthorizedError('Unable to refresh access JWT')
      }

      apiUtils.sendResult(res, issueTokens(res, await users.getUsableUser(userId)))
    },

    async postLogout(_req: Request, res: Response) {
      res.clearCookie('refreshToken')
      res.sendStatus(200)
    }
  }
}
