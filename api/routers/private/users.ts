import { Router } from 'express'
import { createUsersPrivateControllers } from '../../controllers/private/users'
import { asyncHandler } from '../../middlewares/async-handler'
import { hasAdminStatus } from '../../middlewares/users'
import { AppServices } from '../../src/legacy/legacy-services'

export function createUsersPrivateRouter(services: Pick<AppServices, 'users'>) {
  const controllers = createUsersPrivateControllers(services)

  return Router()
    .get('/', hasAdminStatus, asyncHandler(controllers.get))
    .put('/:id', hasAdminStatus, asyncHandler(controllers.put))
}
