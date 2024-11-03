import { NextFunction, Response } from 'express'
import { AuthorizedRequest } from '../../utils/types'
import { dbService } from '../../services/db'
import { Entity } from '../../utils/constants'

async function deleteCollections(req: AuthorizedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.query.collections) {
      return res.sendStatus(400)
    }

    const collections = (req.query.collections as string).split(',')

    await Promise.all(collections.map((collection) => dbService.deleteAll(collection as Entity)))

    res.sendStatus(200)
  } catch (error) {
    next(error)
  }
}

export const debugControllers = {
  deleteCollections
}
