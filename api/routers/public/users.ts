import { Router } from 'express'
import { validate } from 'simple-express-validation'
import { createUsersPublicControllers } from '../../controllers/public/users'
import { asyncHandler } from '../../middlewares/async-handler'
import { authRateLimiter } from '../../middlewares/rateLimiters'
import { AppServices } from '../../src/legacy/legacy-services'
import { usersPublicValidationSchemas } from '../../validation/public/users'

export function createUsersPublicRouter(services: Pick<AppServices, 'users' | 'verificationMailer'>) {
  const controllers = createUsersPublicControllers(services)

  return (
    Router()
      // Signup
      .post(
        '/',
        authRateLimiter,
        validate(usersPublicValidationSchemas.postUser.bodySchema),
        asyncHandler(controllers.postUser)
      )
      // Email Verification
      .get('/verify', asyncHandler(controllers.getVerifyEmail))
  )
}
