import { Response } from 'express'
import { AuthorizedRequest } from '../../utils/types'
import { dbService } from '../../services/db'
import { Entity, errors } from '../../utils/constants'
import { apiUtils } from '../../utils/api'
import { tryCatch } from '../../utils/decorators'

const ENTITIES: string[] = Object.values(Entity)

async function deleteCollections(req: AuthorizedRequest, res: Response) {
  if (typeof req.query.collections !== 'string' || !req.query.collections) {
    return apiUtils.sendError(res, errors.BAD_REQUEST)
  }

  const collections = req.query.collections.split(',')

  if (!collections.every((collection) => ENTITIES.includes(collection))) {
    return apiUtils.sendError(res, errors.BAD_REQUEST)
  }

  await Promise.all(collections.map((collection) => dbService.deleteAll(collection as Entity)))

  res.sendStatus(200)
}

export const debugControllers = {
  deleteCollections: tryCatch(deleteCollections)
}
