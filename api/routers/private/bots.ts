import { Router } from 'express'
import { createBotsPrivateControllers } from '../../controllers/private/bots'
import { asyncHandler } from '../../middlewares/async-handler'
import { validateIdParam } from '../../middlewares/validateId'
import { AppServices } from '../../src/legacy/legacy-services'

export function createBotsPrivateRouter(services: Pick<AppServices, 'bots' | 'scan'>) {
  const controllers = createBotsPrivateControllers(services)

  return Router()
    .post('/base', asyncHandler(controllers.postUserBase))
    .post('/:id/scan', validateIdParam('id'), asyncHandler(controllers.postScan))
}
