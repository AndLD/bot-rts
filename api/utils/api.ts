import { Response } from 'express'
import { refreshJwtExpiresIn } from './jwt'
import { convertTimeStringToMilliseconds } from './duration'

function sendResult(res: Response, result: unknown) {
  res.json({
    result
  })
}

function setRefreshTokenCookie(res: Response, refreshToken: string) {
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: convertTimeStringToMilliseconds(refreshJwtExpiresIn),
    signed: false
  })
}

export const apiUtils = {
  sendResult,
  setRefreshTokenCookie
}
