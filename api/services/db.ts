import { MongoClient, Db, WithTransactionCallback, Collection } from 'mongodb'
import { getLogger } from '../utils/logger'
import { Entity } from '../utils/constants'
import { IBot } from '../utils/interfaces/bots'
import { IMapPoint } from '../utils/interfaces/map'
import { IUser } from '../utils/interfaces/users'
import { IFile } from '../utils/interfaces/files'

let mongoClient: MongoClient
export let db: Db
export let usersCollection: Collection<IUser>
export let botsCollection: Collection<IBot>
export let mapCollection: Collection<IMapPoint>
export let filesCollection: Collection<IFile>

const logger = getLogger('services/db')

async function init() {
    mongoClient = new MongoClient(process.env.MONGO_DB_URI || 'mongodb://localhost:27017')
    await mongoClient.connect()
    db = mongoClient.db(process.env.MONGO_DB_NAME || 'bot-rts')
    usersCollection = db.collection<IUser>(Entity.USERS)
    botsCollection = db.collection<IBot>(Entity.BOTS)
    mapCollection = db.collection<IMapPoint>(Entity.MAP)
    filesCollection = db.collection<IFile>(Entity.FILES)

    logger.info('MongoDB successfully connected')
}

async function close() {
    await mongoClient.close()
}

async function withTransaction(fn: WithTransactionCallback<void>) {
    const session = mongoClient.startSession()

    const result = await session.withTransaction(fn)

    session.endSession()

    return result
}

export const dbService = {
    init,
    close,
    withTransaction
}
