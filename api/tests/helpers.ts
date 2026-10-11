import express, { RequestHandler } from 'express'
import jwt from 'jsonwebtoken'
import { IUser, IUserState } from '@lib/utils/interfaces/users'
import { accessJwtSecret } from '../utils/jwt'
import { AuthorizedRequest } from '../utils/types'

export function makeUser(overrides: Partial<IUser> = {}): IUser {
  return {
    _id: '64b7f0f2a1b2c3d4e5f60718',
    name: 'Alice',
    email: 'alice@example.com',
    password: 'hash',
    status: 'user',
    active: true,
    subscription: 'free',
    createdAt: 1,
    keywords: [],
    user: '',
    ...overrides
  }
}

export function signAccessToken(payload: unknown, options: jwt.SignOptions = {}) {
  return jwt.sign(payload as object, accessJwtSecret, { expiresIn: '5m', ...options })
}

export function makeApp(setup: (app: express.Express) => void) {
  const app = express()
  app.use(express.json())
  app.use(express.urlencoded({ extended: true }))
  setup(app)
  return app
}

export function asUser(user: Record<string, unknown>): RequestHandler {
  return (req, _res, next) => {
    const authorized: AuthorizedRequest = req
    authorized.user = user as unknown as IUserState
    next()
  }
}
