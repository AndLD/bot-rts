import { NextFunction, Request, Response } from 'express'
import { db } from '../services/db'
import { apiUtils } from '../utils/api'
import { Entity, errors } from '../utils/constants'
import { tryCatch } from '../utils/decorators'
import { Controller } from '../utils/types'
import { ObjectId } from 'mongodb'

function isEntityExists(entity?: Entity, bodyIdKey?: string) {
  return tryCatch(async function (req: any, res: Response, next: NextFunction) {
    const id: string | undefined = bodyIdKey ? req.body[bodyIdKey] : req.params.id

    if (!id) {
      return next()
    }

    const doc = await db.collection(entity || req.entity).findOne({ _id: new ObjectId(id) })

    if (!doc) {
      return apiUtils.sendError(res, errors.DOC_NOT_FOUND)
    }

    next()
  } as Controller)
}

function isEntitiesExists(entity: Entity, bodyIdsKey?: string) {
  return tryCatch(async function (req: any, res: Response, next: NextFunction) {
    const ids: string[] = bodyIdsKey ? req.body[bodyIdsKey] : req.query.ids

    if (!ids?.length) {
      return next()
    }

    // Convert string IDs to ObjectID
    const objectIds = ids.map((id) => new ObjectId(id))

    const docs = await db
      .collection(entity)
      .find({ _id: { $in: objectIds } })
      .toArray()

    if (docs.length !== ids.length) {
      return apiUtils.sendError(res, errors.DOC_NOT_FOUND)
    }

    next()
  } as Controller)
}

function isEntityUsed(entity: Entity, getFilterCallback: (req: Request) => any) {
  return tryCatch(async function (req: Request, res: Response, next: NextFunction) {
    const filter = getFilterCallback(req)

    const doc = await db.collection(entity).findOne(filter)

    if (doc) {
      return apiUtils.sendError(res, errors.ENTITY_USED)
    }

    next()
  } as Controller)
}

function isEntityAlreadyExists(entity: Entity, getFilterCallback: (req: Request) => any) {
  return tryCatch(async function (req: Request, res: Response, next: NextFunction) {
    const filter = getFilterCallback(req)

    const docs = await db.collection(entity).find(filter).toArray()

    if (docs.length) {
      return apiUtils.sendError(res, errors.ENTITY_ALREADY_EXISTS)
    }

    next()
  } as Controller)
}

function isBodyArrayUnique(bodyKey: string) {
  return function (req: Request, res: Response, next: NextFunction) {
    const array = req.body[bodyKey]

    if (!array?.length) {
      return next()
    }

    if (new Set(array).size !== array.length) {
      return apiUtils.sendError(res, errors.ARRAY_CONTAINS_NOT_UNIQUE)
    }

    next()
  }
}

export const validationMiddlewares = {
  isEntityExists,
  isEntitiesExists,
  isEntityUsed,
  isEntityAlreadyExists,
  isBodyArrayUnique
}
