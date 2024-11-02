import { Response } from 'express'
import { Error } from './types'
import { Utils } from './utils'

function sendError(res: Response, error: Error) {
  res.status(error.code || 500).json({
    error: error.msg
  })
  return
}

function sendResult(res: Response, result: any) {
  res.json({
    result
  })
  return
}

function setRefreshTokenCookie(res: Response, refreshToken: string) {
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: Utils.convertTimeStringToMilliseconds(process.env.REFRESH_JWT_EXPIRES_IN || '30d'),
    signed: false
  })
}

export const apiUtils = {
  sendError,
  sendResult,
  setRefreshTokenCookie
}
