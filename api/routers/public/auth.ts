import { Router } from 'express'
import { validate } from 'simple-express-validation'
import { authPublicControllers } from '../../controllers/public/auth'
import { authPublicValidationSchemas } from '../../validation/public/auth'
import { authRateLimiter } from '../../middlewares/rateLimiters'

export default Router()
  .post(
    '/login',
    authRateLimiter,
    validate(authPublicValidationSchemas.postLogin.bodySchema),
    authPublicControllers.postLogin
  )
  // Refresh access token
  .get('/refresh', authRateLimiter, authPublicControllers.getRefresh)
  .post('/logout', authPublicControllers.postLogout)
