import { Express, Router } from 'express'
import { createIsAuthorized } from '../middlewares/authorization'
import { handleError } from '../middlewares/error-handler'
import { AppServices } from '../src/composition'
import { authPrivateRouter } from '../routers/private/auth'
import { createBotsPrivateRouter } from '../routers/private/bots'
import { createStatisticsPrivateRouter } from '../routers/private/statistics'
import { createUsersPrivateRouter } from '../routers/private/users'
import { createAuthPublicRouter } from '../routers/public/auth'
import { createUsersPublicRouter } from '../routers/public/users'

export function setupRouters(app: Express, services: AppServices) {
  const apiRouter = Router()
  app.use('/api', apiRouter)

  // Unauthorized router
  const publicRouter = Router()
  apiRouter.use('/public', publicRouter)

  publicRouter.use('/auth', createAuthPublicRouter(services))
  publicRouter.use('/users', createUsersPublicRouter(services))

  // Authorized router
  const privateRouter = Router()
  apiRouter.use('/private', createIsAuthorized(services.users), privateRouter)

  privateRouter.use('/auth', authPrivateRouter)
  privateRouter.use('/users', createUsersPrivateRouter(services))
  privateRouter.use('/statistics', createStatisticsPrivateRouter(services))
  privateRouter.use('/bots', createBotsPrivateRouter(services))

  app.use(handleError)
}
