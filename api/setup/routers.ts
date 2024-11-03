import { Express, NextFunction, Request, Response, Router } from 'express'
// import { boardsRouter } from '../routers/boards'
import { ErrorHandler, handleError } from '../middlewares/ErrorHandler'
import { Entity } from '../utils/constants'
import { hasAdminStatus, isAuthorized } from '../middlewares/users'
import { setReqEntity } from '../middlewares/decorators'
import authPublicRouter from '../routers/public/auth'
import authPrivateRouter from '../routers/private/auth'
import { statisticsPrivateRouter } from '../routers/private/statistics'
import { usersPrivateRouter } from '../routers/private/users'
import usersPublicRouter from '../routers/public/users'
import { botsPrivateRouter } from '../routers/private/bots'
import { debugPrivateRouter } from '../routers/private/debug'

export function setupRouters(app: Express) {
  const apiRouter = Router()
  app.use('/api', apiRouter)

  // Unauthorized router
  const publicRouter = Router()
  apiRouter.use('/public', publicRouter)

  publicRouter.use('/auth', authPublicRouter)
  publicRouter.use('/users', setReqEntity(Entity.USERS), usersPublicRouter)

  // Authorized router
  const privateRouter = Router()
  apiRouter.use('/private', isAuthorized, privateRouter)

  privateRouter.use('/auth', authPrivateRouter)
  privateRouter.use('/users', usersPrivateRouter)
  privateRouter.use('/statistics', statisticsPrivateRouter)
  privateRouter.use('/bots', botsPrivateRouter)
  privateRouter.use('/debug', hasAdminStatus, debugPrivateRouter)

  app.use((err: ErrorHandler, req: Request, res: Response, next: NextFunction) => handleError(err, res))
}
