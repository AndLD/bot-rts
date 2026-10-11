import express, { Router } from 'express'
import { createBotsPrivateRouter } from '../../routers/private/bots'
import { createIsAuthorized } from '../../middlewares/authorization'
import { handleError } from '../../middlewares/error-handler'
import { AppServices } from './legacy-services'

// The Express routers that are still to be migrated to Nest controllers (strangler approach, task 1.12)
export function createLegacyRouter(services: AppServices) {
  const router = Router()
  const privateRouter = Router()

  router.use('/api/private', express.json(), createIsAuthorized(services.auth), privateRouter)
  privateRouter.use('/bots', createBotsPrivateRouter(services))
  router.use('/api/private', handleError)

  return router
}
