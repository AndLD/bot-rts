import { Response } from 'express'
import { db } from '../../services/db'
import { usersService } from '../../services/users'
import { apiUtils } from '../../utils/api'
import { Entity, isProduction, startTimestamp } from '../../utils/constants'
import { tryCatch } from '../../utils/decorators'
import { Utils } from '../../utils/utils'
import path from 'path'

async function getStatistics(_: any, res: Response) {
  const usersByStatus = await usersService.countUsersByState()
  if (!usersByStatus) {
    return
  }

  // Get total count of documents for each collection
  const totals: any = {}
  for (const entity of Object.keys(Entity)) {
    const collection = entity.toLowerCase()

    const key = `${collection}Total`

    totals[key] = await db.collection(collection).countDocuments()
  }

  const filesSizeTotal = Utils.getDirectorySizeSync(
    path.join(__dirname, isProduction ? '../../../public' : '../../public')
  )

  const result = {
    usersByStatus,
    ...totals,
    startTimestamp,
    filesSizeTotal
  }

  apiUtils.sendResult(res, result)
}

export const privateStatisticsControllers = {
  getStatistics: tryCatch(getStatistics)
}
