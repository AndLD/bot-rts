import jwt from 'jsonwebtoken'
import { IUserState } from './interfaces/users'

export const accessJwtSecret: string = process.env.JWT_ACCESS_SECRET || 'super_secret1'
const accessJwtExpiresIn: string = process.env.JWT_ACCESS_EXPIRES_IN || '10m'

export const refreshJwtSecret: string = process.env.JWT_REFRESH_SECRET || 'super_secret2'
export const refreshJwtExpiresIn: string = process.env.JWT_REFRESH_EXPIRES_IN || '24h'

export const emailVerificationJwtSecret: string =
    process.env.JWT_EMAIL_VERIFICATION_SECRET || 'super_secret3'
const emailVerificationJwtExpiresIn: string = process.env.JWT_EMAIL_VERIFICATION_EXPIRES_IN || '24h'

export function createJwt(userState: IUserState) {
    const accessToken = jwt.sign({ user: userState }, accessJwtSecret, {
        expiresIn: accessJwtExpiresIn
    })
    const refreshToken = jwt.sign(
        {
            user: {
                _id: userState._id
            }
        },
        refreshJwtSecret,
        {
            expiresIn: refreshJwtExpiresIn
        }
    )

    return {
        accessToken,
        refreshToken
    }
}

export function createEmailVerificationJwt(userId: string) {
    return jwt.sign({ user: { id: userId } }, emailVerificationJwtSecret, {
        expiresIn: emailVerificationJwtExpiresIn
    })
}
