import { Router } from 'express'
import { debugControllers } from '../../controllers/private/debug'

export const debugPrivateRouter = Router().delete('/collections', debugControllers.deleteCollections)
