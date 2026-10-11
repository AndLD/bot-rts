import { Response } from 'express'
import { toBotDto } from '../../src/bots/presentation/bot.mapper'
import { AppServices } from '../../src/legacy/legacy-services'
import { toMapPointDto } from '../../src/map/presentation/map-point.mapper'
import { toModuleDto } from '../../src/modules/presentation/module.mapper'
import { AuthorizedRequest } from '../../middlewares/authorization'

export function createBotsPrivateControllers({ bots, scan }: Pick<AppServices, 'bots' | 'scan'>) {
  return {
    async postUserBase(req: AuthorizedRequest, res: Response) {
      const user = req.user!
      const { bot, modules, mapPoint } = await bots.deployUserBase({ id: user._id, name: user.name })

      res.json({ bot: toBotDto(bot), modules: modules.map(toModuleDto), mapPoint: toMapPointDto(mapPoint) })
    },

    async postScan(req: AuthorizedRequest, res: Response) {
      const seen = await scan.scan(req.user!._id, String(req.params.id))

      res.json(seen.map(toMapPointDto))
    }
  }
}
