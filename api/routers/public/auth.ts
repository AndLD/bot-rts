import { Router } from 'express'
import { validate } from 'simple-express-validation'
import { createAuthPublicControllers } from '../../controllers/public/auth'
import { asyncHandler } from '../../middlewares/async-handler'
import { authRateLimiter } from '../../middlewares/rateLimiters'
import { AppServices } from '../../src/composition'
import { authPublicValidationSchemas } from '../../validation/public/auth'

export function createAuthPublicRouter(services: Pick<AppServices, 'users'>) {
  const controllers = createAuthPublicControllers(services)

  return Router()
    .post(
      '/login',
      authRateLimiter,
      validate(authPublicValidationSchemas.postLogin.bodySchema),
      asyncHandler(controllers.postLogin)
    )
    .get('/refresh', authRateLimiter, asyncHandler(controllers.getRefresh))
    .post('/logout', asyncHandler(controllers.postLogout))
}
