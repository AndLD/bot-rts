import { Router } from 'express'
import { validateIdParam } from '../../middlewares/validateId'
import { botsPrivateControllers } from '../../controllers/private/bots'

export const botsPrivateRouter = Router()
  .post('/base', botsPrivateControllers.postUserBase)
  .post('/:id/scan', validateIdParam('id'), botsPrivateControllers.postScan)
