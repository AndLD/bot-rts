import { MongoClient, Db, WithTransactionCallback, Collection } from 'mongodb'
import { getLogger } from '../utils/logger'
import { Entity } from '../utils/constants'
import { IBot } from '@lib/utils/interfaces/bots'
import { IMapPoint } from '@lib/utils/interfaces/map'
import { IUser } from '@lib/utils/interfaces/users'
import { IFile } from '@lib/utils/interfaces/files'
import { IModuleProps, ModuleProps } from '@lib/utils/interfaces/modules'

let mongoClient: MongoClient
export let db: Db
export let usersCollection: Collection<IUser>
export let botsCollection: Collection<IBot>
export let modulesCollection: Collection<ModuleProps>
export let mapCollection: Collection<IMapPoint>
export let filesCollection: Collection<IFile>

const logger = getLogger('services/db')

async function init() {
  mongoClient = new MongoClient(process.env.MONGO_DB_URI || 'mongodb://localhost:27017')
  await mongoClient.connect()
  db = mongoClient.db(process.env.MONGO_DB_NAME || 'bot-rts')
  usersCollection = db.collection<IUser>(Entity.USERS)
  botsCollection = db.collection<IBot>(Entity.BOTS)
  modulesCollection = db.collection<IModuleProps>(Entity.MODULES)
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

async function deleteAll(collection: Entity) {
  await db.collection(collection).deleteMany({})
}

export const dbService = {
  init,
  close,
  withTransaction,
  deleteAll
}
