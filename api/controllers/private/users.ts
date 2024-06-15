import { Request, Response, NextFunction } from 'express'
import { ObjectId } from 'mongodb'
import { db } from '../../services/db'
import { AuthorizedRequest } from '../../utils/types'
import { usersService } from '../../services/users'

const collectionName = 'users'

async function get(req: AuthorizedRequest, res: Response, next: NextFunction) {
    try {
        const clientFilter = req.query.filters
            ? JSON.parse(req.query.filters as string)
            : {}
        const pagination = {
            page: req.query.page ? parseInt(req.query.page as string) : 1,
            results: req.query.results
                ? parseInt(req.query.results as string)
                : 10
        }
        const skip = (pagination.page - 1) * pagination.results
        const limit = pagination.results

        const users = await usersService.getUsersWithTotalNodesPerCluster(
            clientFilter,
            skip,
            limit
        )

        const total = await db
            .collection(collectionName)
            .countDocuments(clientFilter)

        res.json({
            result: users.map(({ password, ...rest }) => rest),
            meta: { pagination: { ...pagination, total } }
        })
    } catch (err) {
        next(err)
    }
}

async function put(req: Request, res: Response, next: NextFunction) {
    try {
        const id = req.params.id
        const data = req.body

        const updateResult = await db
            .collection(collectionName)
            .updateOne(
                { _id: new ObjectId(id) },
                { $set: { ...data, updatedAt: new Date().getTime() } }
            )

        if (updateResult.modifiedCount === 0) {
            return next(new Error('User was not updated'))
        }

        const result = await db
            .collection(collectionName)
            .findOne({ _id: new ObjectId(id) })

        res.json({ result })
    } catch (err) {
        next(err)
    }
}

export const usersPrivateControllers = {
    get,
    put
}
