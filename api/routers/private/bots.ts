import { Router } from 'express'
import { botsPrivateControllers } from '../../controllers/private/bots'

export const botsPrivateRouter = Router()
  .post('/base', botsPrivateControllers.postUserBase)
  .post('/:id/scan', botsPrivateControllers.postScan)
