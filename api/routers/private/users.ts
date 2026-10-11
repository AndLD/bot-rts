import { Router } from 'express'
import { usersPrivateControllers } from '../../controllers/private/users'
import { hasAdminStatus } from '../../middlewares/users'

export const usersPrivateRouter = Router()
  .get('/', hasAdminStatus, usersPrivateControllers.get)
  .put('/:id', hasAdminStatus, usersPrivateControllers.put)
