import { NextFunction, Response } from 'express'
import { AuthorizedRequest } from '../../utils/types'
import { botsService } from '../../services/bots'
import { modulesService } from '../../services/modules'
import ScannerModule from '../../models/modules/ScannerModule'
import { IScannerModuleProps } from '@lib/utils/interfaces/modules'

async function postUserBase(req: AuthorizedRequest, res: Response, next: NextFunction) {
  try {
    const user = req.user!

    const result = await botsService.deployUserBase(user)

    return res.json(result)
  } catch (error) {
    next(error)
  }
}

async function postScan(req: AuthorizedRequest, res: Response, next: NextFunction) {
  try {
    const botId = req.params.id
    const user = req.user!

    const bot = await botsService.getBotById(botId)
    if (!bot) {
      return res.sendStatus(404)
    }
    if (bot.userId != user._id) {
      return res.sendStatus(403)
    }

    const modules = await modulesService.getBotModules(botId)

    const scannerProps = modules.find((module) => module.type === 'scanner') as IScannerModuleProps | undefined
    if (!scannerProps) {
      return res.sendStatus(400)
    }

    const scanner = new ScannerModule(scannerProps)

    const result = await scanner.scan()

    return res.json(result)
  } catch (error) {
    next(error)
  }
}

export const botsPrivateControllers = {
  postUserBase,
  postScan
}
