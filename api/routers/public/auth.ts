import { Router } from 'express'
import { validate } from 'simple-express-validation'
import { authPublicControllers } from '../../controllers/public/auth'
import { authPublicValidationSchemas } from '../../validation/public/auth'

export default Router()
    .post(
        '/login',
        validate(authPublicValidationSchemas.postLogin.bodySchema),
        authPublicControllers.postLogin
    )
    // Refresh access token
    .get('/refresh', authPublicControllers.getRefresh)
    .post('/logout', authPublicControllers.postLogout)
