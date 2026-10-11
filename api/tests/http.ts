import express, { Express, RequestHandler } from 'express'
import { handleError } from '../middlewares/error-handler'
import { User } from '../src/users/domain/user.entity'
import { toUserState } from '../src/users/presentation/user.mapper'
import { AuthorizedRequest } from '../middlewares/authorization'

// An Express app with JSON parsing and the real error handler, for HTTP-level tests of routers and middlewares
export function makeApp(setup: (app: Express) => void) {
  const app = express()
  app.use(express.json())
  setup(app)
  app.use(handleError)
  return app
}

export function asUser(user: User, isEmailVerified = true): RequestHandler {
  return (req: AuthorizedRequest, _res, next) => {
    req.user = toUserState(user, isEmailVerified)
    next()
  }
}
