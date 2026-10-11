import { Request, Response } from 'express'
import { AppServices } from '../../src/composition'
import { apiUtils } from '../../utils/api'
import { startTimestamp } from '../../utils/constants'

export function createStatisticsPrivateControllers({ users }: Pick<AppServices, 'users'>) {
  return {
    async getStatistics(_req: Request, res: Response) {
      apiUtils.sendResult(res, { usersByStatus: await users.countByStatus(), startTimestamp })
    }
  }
}
