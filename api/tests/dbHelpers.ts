import { ObjectId } from 'mongodb'
import { db } from '../services/db'

let insertedDocs: { [collection: string]: ObjectId[] } = {}

export const trackInsert = (collection: string, id: ObjectId) => {
    if (!insertedDocs[collection]) {
        insertedDocs[collection] = []
    }
    insertedDocs[collection].push(id)
}

export const clearInsertedDocs = async () => {
    for (const collection in insertedDocs) {
        const ids = insertedDocs[collection]
        await db.collection(collection).deleteMany({ _id: { $in: ids } })
    }
    insertedDocs = {}
}
