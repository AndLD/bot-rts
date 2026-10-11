import express, { Router } from 'express'
import { authPrivateRouter } from '../../routers/private/auth'
import { createBotsPrivateRouter } from '../../routers/private/bots'
import { createStatisticsPrivateRouter } from '../../routers/private/statistics'
import { createUsersPrivateRouter } from '../../routers/private/users'
import { createAuthPublicRouter } from '../../routers/public/auth'
import { createUsersPublicRouter } from '../../routers/public/users'
import { createIsAuthorized } from '../../middlewares/authorization'
import { handleError } from '../../middlewares/error-handler'
import { AppServices } from './legacy-services'

// The Express routers that are still to be migrated to Nest controllers (strangler approach, task 1.12)
export function createLegacyRouter(services: AppServices) {
  const router = Router()
  const apiRouter = Router()

  router.use('/api', apiRouter)
  // Mounted before Nest registers its own body parser, so the legacy routes parse JSON themselves
  apiRouter.use(express.json())

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

  apiRouter.use(handleError)

  return router
}
