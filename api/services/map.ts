import { Filter, ObjectId } from 'mongodb'
import { IMapPoint, IPostMapPoint, IUpsertMapPoint, Location, MapPointType } from '../utils/interfaces/map'
import { mapCollection } from './db'
import { ErrorHandler } from '../middlewares/ErrorHandler'
import { ID } from '../utils/types'
import { Utils } from '../utils/utils'

async function _addMapPoints(mapPoints: IMapPoint[]) {
  const result = await mapCollection.insertMany(mapPoints)

  if (!result.acknowledged || result.insertedCount !== mapPoints.length) {
    throw new ErrorHandler(500, 'MapPoints were not stored!')
  }

  return mapPoints
}

async function upsertMapPoint(mapPoint: IPostMapPoint): Promise<IMapPoint> {
  // const expectedResult: IPostMapPoint[] = []
  const bulkOps = []

  const { userId, ...realMapPoint } = mapPoint

  const locationFilter = {
    'location.x': realMapPoint.location.x,
    'location.y': realMapPoint.location.y,
    'location.z': realMapPoint.location.z ? realMapPoint.location.z : { $exists: false }
  }

  // General map point upsert (without userId)
  bulkOps.push({
    updateOne: {
      filter: {
        ...locationFilter,
        userId: { $exists: false }
      },
      update: { $set: realMapPoint },
      upsert: true
    }
  })
  // expectedResult.push(realMapPoint)

  // Specific user map point upsert (with userId)
  if (userId) {
    bulkOps.push({
      updateOne: {
        filter: {
          ...locationFilter,
          userId
        },
        update: { $set: mapPoint },
        upsert: true
      }
    })
    // expectedResult.push(point)
  }

  // Execute the bulk write operations
  const bulkWriteResult = await mapCollection.bulkWrite(bulkOps)

  if (!bulkWriteResult.ok || bulkWriteResult.upsertedCount < 1) {
    throw new ErrorHandler(500, 'Map point was not upserted!')
  }

  const doc = bulkWriteResult.getRawResponse()
  // const result = expectedResult.map((mapPoint, i) => ({ ...mapPoint, _id: doc.upserted[i]._id }))

  return userId ? { ...mapPoint, _id: doc.upserted[1]._id } : { ...realMapPoint, _id: doc.upserted[1]._id }
}

// TODO: Optimize (pay attention to _id in IMapPoint)
async function _upsertMapPoints(mapPoints: IUpsertMapPoint[]) {
  const bulkOps = mapPoints.map((mapPoint) => {
    const locationFilter = {
      'location.x': mapPoint.location.x,
      'location.y': mapPoint.location.y,
      'location.z': mapPoint.location.z ? mapPoint.location.z : { $exists: false },
      userId: mapPoint.userId ? mapPoint.userId : { $exists: false }
    }

    return {
      updateOne: {
        filter: locationFilter,
        update: { $set: mapPoint },
        upsert: true
      }
    }
  })

  // Execute the bulk write operations
  const bulkWriteResult = await mapCollection.bulkWrite(bulkOps)
  if (!bulkWriteResult.ok) {
    throw new ErrorHandler(500, `Map points were not upserted correctly, bulkOps.length = ${bulkOps.length}`)
  }

  const rawResponse = bulkWriteResult.getRawResponse()

  const upsertedIds = rawResponse.upserted.map((upsertedDoc: any) => upsertedDoc._id)

  return await _getMapPointsByIds(upsertedIds)
}

async function _getMapPointsByIds(ids: ID[]) {
  const result = await mapCollection
    .find({
      _id: { $in: ids.map((id) => (typeof id === 'string' ? new ObjectId(id) : id)) }
    })
    .toArray()

  return result
}

function _prepareNewPoint(location: Location): IMapPoint {
  const point: IMapPoint = {
    _id: new ObjectId(),
    location,
    type: Math.random() < 0.2 ? MapPointType.RESOURCE : null,
    contentId: null
  }

  return point
}

async function _generateMapByRange(from: Location, to: Location) {
  const preparedPoints: IMapPoint[] = []

  for (let x = from.x; x <= to.x; x++) {
    for (let y = from.y; y < to.y; y++) {
      preparedPoints.push(_prepareNewPoint({ x, y }))
    }
  }

  return await _addMapPoints(preparedPoints)
}

async function _generateMapByLocations(locations: Location[], userId?: ID) {
  const preparedPoints = locations.map((location) => _prepareNewPoint(location))

  if (userId) {
    preparedPoints.push(...preparedPoints.map((preparedPoint) => ({ ...preparedPoint, userId, _id: new ObjectId() })))
  }

  return await _addMapPoints(preparedPoints)
}

async function getMap(from: Location, to: Location, userId?: string) {
  // TODO: Validate "to" coordinates should be greater than "from" or handle these parameters another way

  // Get all (real and user's) points
  const filter: Filter<IMapPoint> = {
    'location.x': { $gte: from.x, $lte: to.x },
    'location.y': { $gte: from.y, $lte: to.y }
  }
  if (userId) {
    filter['$or'] = [{ userId }, { userId: { $exists: false } }]
  } else {
    filter.userId = { $exists: false }
  }

  const allPoints = await mapCollection.find(filter).toArray()

  const userPoints: IMapPoint[] = []
  const realPoints: IMapPoint[] = userId ? [] : allPoints

  if (userId) {
    for (const point of allPoints) {
      if (point.userId) {
        userPoints.push(point)
      } else {
        realPoints.push(point)
      }
    }
  }

  // TODO: Remove
  // const totalPoints = Math.abs(to.x - from.x) * Math.abs(to.y - from.y)
  // console.log('[debug] getMap call, totalPoints =', totalPoints)

  const realPointsObject = Utils.convertMapPointsArrayToObject(realPoints)
  const userPointsObject = Utils.convertMapPointsArrayToObject(userPoints)

  // Real/User points locations to generate
  const locationsToGenerate: Location[] = []
  // User points to add/update
  const userPointsToUpsert: IUpsertMapPoint[] = []
  // The rest of user points
  const userPointsToKeep: IMapPoint[] = []
  for (let x = from.x; x <= to.x; x++) {
    for (let y = from.y; y <= to.y; y++) {
      const realPoint = realPointsObject[`${x}:${y}`]
      const userPoint = userPointsObject[`${x}:${y}`]

      if (!realPoint) {
        locationsToGenerate.push({ x, y })
      } else if (userId) {
        if (
          !userPoint ||
          (userPoint && (realPoint.contentId !== userPoint.contentId || realPoint.type !== userPoint.type))
        ) {
          const { _id, ...headlessRealPoint } = realPoint

          const upsertUserPointBody: IUpsertMapPoint = { ...headlessRealPoint, userId }
          if (userPoint) {
            upsertUserPointBody._id = userPoint._id
          }

          userPointsToUpsert.push(upsertUserPointBody)
        } else if (userPoint) {
          userPointsToKeep.push(userPoint)
        }
      }
    }
  }

  console.log('[debug] getMap details:', {
    'locationsToGenerate.length': locationsToGenerate.length,
    'userPointsToUpsert.length': userPointsToUpsert.length,
    'userPointsToKeep.length': userPointsToKeep.length
  })

  if (!locationsToGenerate.length && !userPointsToUpsert.length) {
    return userId ? userPoints : realPoints
  }

  const userGeneratedPoints: IMapPoint[] = []
  let realGeneratedPoints: IMapPoint[] = []

  if (locationsToGenerate.length) {
    // Generate points
    const allGeneratedPoints = await _generateMapByLocations(locationsToGenerate, userId)

    if (userId) {
      for (const point of allGeneratedPoints) {
        if (point.userId) {
          userGeneratedPoints.push(point)
        } else {
          realGeneratedPoints.push(point)
        }
      }
    } else {
      realGeneratedPoints = allGeneratedPoints
    }

    // TODO: Remove
    // const realGeneratedPointsObject = Utils.convertMapPointsArrayToObject(realGeneratedPoints)
    // const userGeneratedPointsObject = Utils.convertMapPointsArrayToObject(userGeneratedPoints)
  }

  // Upsert user points
  const upsertedUserPoints = userPointsToUpsert.length ? await _upsertMapPoints(userPointsToUpsert) : []

  const result = userId
    ? [...userGeneratedPoints, ...upsertedUserPoints, ...userPointsToKeep]
    : [...realGeneratedPoints, ...realPoints]

  return result
}

async function getLocationByContentIdAndType(contentId: string) {
  const result = await mapCollection.findOne({ userId: { $exists: false }, contentId })

  return result?.location
}

export const mapService = { upsertMapPoint, getMap, getLocationByContentIdAndType }
