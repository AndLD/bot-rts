import { Response } from 'express'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcrypt'
import { usersCollection } from '../../services/db'
import { usersService } from '../../services/users'
import { tryCatch } from '../../utils/decorators'
import { IAuthPostBody } from '@lib/utils/interfaces/auth'
import { errors } from '../../utils/constants'
import { createJwt, refreshJwtSecret } from '../../utils/jwt'
import { parseUserIdFromSessionToken } from '../../utils/jwtPayload'
import { apiUtils } from '../../utils/api'
import { getAccessDenial, toUserState } from '../../utils/userAccess'

async function postLogin(req: any, res: Response) {
  const body: IAuthPostBody = req.body

  const user = await usersCollection.findOne({ email: body.email })

  if (!user) {
    return apiUtils.sendError(res, errors.CREDENTIALS_INVALID)
  }

  // Password check
  const isPasswordValid = await bcrypt.compare(body.password, user.password)

  if (!isPasswordValid) {
    return apiUtils.sendError(res, errors.CREDENTIALS_INVALID)
  }

  const denial = getAccessDenial(user)

  if (denial) {
    return apiUtils.sendError(res, denial)
  }

  const tokens = createJwt(toUserState(user))

  apiUtils.setRefreshTokenCookie(res, tokens.refreshToken)
  res.json({
    result: tokens.accessToken
  })
}

async function getRefresh(req: any, res: Response) {
  const refreshToken = req.cookies.refreshToken

  if (!refreshToken) {
    return apiUtils.sendError(res, errors.UNABLE_TO_REFRESH_ACCESS_JWT)
  }

  let userId: string | undefined

  try {
    userId = parseUserIdFromSessionToken(jwt.verify(refreshToken, refreshJwtSecret, { algorithms: ['HS256'] }))
  } catch (e) {
    return apiUtils.sendError(res, errors.UNABLE_TO_REFRESH_ACCESS_JWT)
  }
  if (!userId) {
    return apiUtils.sendError(res, errors.UNABLE_TO_REFRESH_ACCESS_JWT)
  }

  const user = await usersService.findUserById(userId)
  const denial = getAccessDenial(user)

  if (denial) {
    return apiUtils.sendError(res, denial)
  }

  const tokens = createJwt(toUserState(user!))

  apiUtils.setRefreshTokenCookie(res, tokens.refreshToken)
  apiUtils.sendResult(res, tokens.accessToken)
}

async function postLogout(_: any, res: Response) {
  res.clearCookie('refreshToken')
  res.sendStatus(200)
}

export const authPublicControllers = {
  postLogin: tryCatch(postLogin),
  getRefresh: tryCatch(getRefresh),
  postLogout: tryCatch(postLogout)
}
