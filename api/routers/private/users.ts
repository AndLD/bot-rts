import { Router } from 'express'
import { usersPrivateControllers } from '../../controllers/private/users'

export const usersPrivateRouter = Router()
    .get('/', usersPrivateControllers.get)
    .put('/:id', usersPrivateControllers.put)
