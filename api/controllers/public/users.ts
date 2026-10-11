import { Response } from 'express'
import jwt from 'jsonwebtoken'
import { tryCatch } from '../../utils/decorators'
import { IUserPostBody } from '@lib/utils/interfaces/users'
import { createEmailVerificationJwt, createJwt, emailVerificationJwtSecret } from '../../utils/jwt'
import { usersService } from '../../services/users'
import { emailService } from '../../services/email'
import { apiUtils } from '../../utils/api'
import { errors } from '../../utils/constants'
import { getLogger } from '../../utils/logger'
import { parseUserIdFromEmailVerificationToken } from '../../utils/jwtPayload'
import { toUserState } from '../../utils/userAccess'

const logger = getLogger('controllers/private/users')

async function postUser(req: any, res: Response) {
  const body: IUserPostBody = req.body

  const user = await usersService.getUserByEmail(body.email)
  if (user) {
    return apiUtils.sendError(res, errors.EMAIL_ALREADY_EXISTS)
  }

  const createdUser = await usersService.addUser(body)

  const tokens = createJwt(toUserState(createdUser))

  apiUtils.setRefreshTokenCookie(res, tokens.refreshToken)

  if (!createdUser.active) {
    emailService.sendEmailVerification(createdUser.email, createEmailVerificationJwt(createdUser._id.toString()))
  }

  res.json({
    result: tokens.accessToken
  })
}

async function getVerifyEmail(req: any, res: Response) {
  const token = req.query.token

  if (!token) {
    return apiUtils.sendError(res, errors.BAD_REQUEST)
  }
  if (typeof token !== 'string') {
    return apiUtils.sendError(res, errors.BAD_REQUEST)
  }

  try {
    const userId = parseUserIdFromEmailVerificationToken(
      jwt.verify(token, emailVerificationJwtSecret, { algorithms: ['HS256'] })
    )

    if (!userId) {
      return apiUtils.sendError(res, errors.JWT_INVALID)
    }

    const updatedUser = await usersService.activateUser(userId)

    if (!updatedUser) {
      return apiUtils.sendError(res, errors.DOC_NOT_FOUND)
    }

    // notificationsService.sendNewUserNofication(updatedUser.name, updatedUser.email)

    res.sendStatus(200)
  } catch (e) {
    logger.error(e)
    return apiUtils.sendError(res, errors.JWT_INVALID)
  }
}

export const usersPublicControllers = {
  postUser: tryCatch(postUser),
  getVerifyEmail: tryCatch(getVerifyEmail)
}
