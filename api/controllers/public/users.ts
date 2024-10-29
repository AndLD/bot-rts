import { Response } from 'express'
import jwt from 'jsonwebtoken'
import { tryCatch } from '../../utils/decorators'
import { IUserState, IUserPostBody } from '../../utils/interfaces/users'
import { createEmailVerificationJwt, createJwt, emailVerificationJwtSecret } from '../../utils/jwt'
import { usersService } from '../../services/users'
import { emailService } from '../../services/email'
import { apiUtils } from '../../utils/api'
import { errors } from '../../utils/constants'
import { getLogger } from '../../utils/logger'

const logger = getLogger('controllers/private/users')

async function postUser(req: any, res: Response) {
    const body: IUserPostBody = req.body

    const user = await usersService.getUserByEmail(body.email, res)
    if (user) {
        return apiUtils.sendError(res, errors.EMAIL_ALREADY_EXISTS)
    }

    const createdUser = await usersService.addUser(body, res)
    if (!createdUser) {
        return
    }

    const userState: IUserState = {
        _id: createdUser._id.toString(),
        name: createdUser.name,
        email: createdUser.email,
        status: createdUser.status,
        active: createdUser.active,
        subscription: createdUser.subscription,
        createdAt: createdUser.createdAt,
        updatedAt: createdUser.updatedAt
    }

    const tokens = createJwt(userState)

    res.cookie('refreshToken', tokens.refreshToken, { httpOnly: true })

    if (!createdUser.active) {
        emailService.sendEmailVerification(
            createdUser.email,
            createEmailVerificationJwt(createdUser._id.toString())
        )
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

    try {
        const decodeValue: any = jwt.verify(token, emailVerificationJwtSecret)

        // TODO: Validate decodeValue ?

        const userId = decodeValue.user.id

        const updatedUser = await usersService.activateUser(userId, res)

        if (!updatedUser) {
            return
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
