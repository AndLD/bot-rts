import { Request, Router } from 'express'
import { validate } from 'simple-express-validation'
import { usersPublicControllers } from '../../controllers/public/users'
import { validationMiddlewares } from '../../middlewares/validation'
import { Entity } from '../../utils/constants'
import { usersPublicValidationSchemas } from '../../validation/public/users'

export default Router()
    // Signup
    .post(
        '/',
        validate(usersPublicValidationSchemas.postUser.bodySchema),
        validationMiddlewares.isEntityAlreadyExists(Entity.USERS, (req: Request) => ({
            email: req.body.email
        })),
        usersPublicControllers.postUser
    )
    // Email Verification
    .get('/verify', usersPublicControllers.getVerifyEmail)
