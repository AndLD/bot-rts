import { ObjectId } from 'mongodb'
import { BOT_TYPE, IBot, IPostBot } from '../utils/interfaces/bots'
import { IUserState } from '../utils/interfaces/users'
import { botsCollection, modulesCollection } from './db'
import { ErrorHandler } from '../middlewares/ErrorHandler'
import { ID } from '../utils/types'
import { IMapPoint, IPostMapPoint, Location, MapPointType } from '../utils/interfaces/map'
import { mapService } from './map'
import { Utils } from '../utils/utils'
import { modulesService } from './modules'
import { IModuleProps } from '../utils/interfaces/modules'
import { initialUserBaseModules } from '../models/modules'

async function getBotById(id: ID) {
  const result = await botsCollection.findOne({ _id: new ObjectId(id) })

  return result
}

async function getBotsByUserId(userId: ID) {
  const result = await botsCollection.find({ userId: userId.toString() }).toArray()

  return result
}

async function addBot(botBody: IPostBot) {
  const bot: IBot = {
    _id: new ObjectId(),
    ...botBody
  }

  const result = await botsCollection.insertOne(bot)

  if (!result.acknowledged) {
    throw new ErrorHandler(500, 'Bot was not stored!')
  }

  return bot
}

async function deployUserBase(
  user: IUserState,
  location?: Location
): Promise<{ bot: IBot; modules: IModuleProps[]; mapPoint: IMapPoint }> {
  const base: IPostBot = {
    _id: new ObjectId(),
    label: `${user.name} base`,
    userId: user._id.toString(),
    type: BOT_TYPE.BASE
  }

  const bots = await getBotsByUserId(user._id)

  if (bots.length) {
    throw new ErrorHandler(403, 'User base already exists')
  }

  const spawnMaxDistance = 10

  const mapPoint: IPostMapPoint = {
    location: location
      ? location
      : ({ x: Utils.getRandomInt(0, spawnMaxDistance), y: Utils.getRandomInt(0, spawnMaxDistance) } as Location),
    contentId: base._id!.toString(),
    type: MapPointType.BASE,
    userId: user._id.toString()
  }

  const [addBotResult, attachModulesToBotResult, upsertMapPointResult] = await Promise.all([
    botsService.addBot(base),
    modulesService.attachModulesToBot(base._id!, initialUserBaseModules),
    mapService.upsertMapPoint(mapPoint)
  ])

  if (!upsertMapPointResult) {
    throw new ErrorHandler(500, 'User base is not stored')
  }

  return { bot: addBotResult, modules: attachModulesToBotResult, mapPoint: upsertMapPointResult }
}

async function getUserIdByBotId(botId: string) {
  const bot = await botsService.getBotById(botId)
  return bot?.userId
}

async function getUserBots(userId: string, filter?: { type?: BOT_TYPE }) {
  let _filter = { userId }
  if (filter) {
    _filter = { ..._filter, ...filter }
  }

  return await botsCollection.find(_filter).toArray()
}

export const botsService = {
  deployUserBase,
  addBot,
  getBotById,
  getBotsByUserId,
  getUserIdByBotId,
  getUserBots
}
