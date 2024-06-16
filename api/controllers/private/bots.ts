import { NextFunction, Response } from 'express'
import { AuthorizedRequest } from '../../utils/types'
import { botsService } from '../../services/bots'

async function postUserBase(req: AuthorizedRequest, res: Response, next: NextFunction) {
    const user = req.user!

    const result = await botsService.deployUserBase(user)

    return res.json(result)
}

export const botsPrivateControllers = {
    postUserBase
}
