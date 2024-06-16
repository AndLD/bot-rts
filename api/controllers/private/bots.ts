import { NextFunction, Response } from 'express'
import { AuthorizedRequest } from '../../utils/types'
import { botsService } from '../../services/bots'

async function postUserBase(req: AuthorizedRequest, res: Response, next: NextFunction) {
    try {
        const user = req.user!

        const result = await botsService.deployUserBase(user)

        return res.json(result)
    } catch (error) {
        next(error)
    }
}

export const botsPrivateControllers = {
    postUserBase
}
