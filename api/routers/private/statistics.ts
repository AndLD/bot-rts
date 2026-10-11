import { Router } from 'express'
import { createStatisticsPrivateControllers } from '../../controllers/private/statistics'
import { asyncHandler } from '../../middlewares/async-handler'
import { hasAdminStatus } from '../../middlewares/users'
import { AppServices } from '../../src/legacy/legacy-services'

export function createStatisticsPrivateRouter(services: Pick<AppServices, 'users'>) {
  return Router().get('/', hasAdminStatus, asyncHandler(createStatisticsPrivateControllers(services).getStatistics))
}
