import { ObjectId } from 'mongodb'
import { IMapPoint, IPostMapPoint, Location } from '../utils/interfaces/map'
import { mapCollection } from './db'
import { ErrorHandler } from '../middlewares/ErrorHandler'

async function addMapPoints(mapPoints: IMapPoint[]) {
  const result = await mapCollection.insertMany(mapPoints)

  if (!result.acknowledged || result.insertedCount !== mapPoints.length) {
    throw new ErrorHandler(500, 'MapPoints were not stored!')
  }

  return mapPoints
}

async function upsertMapPoint(userMapPoint: IPostMapPoint): Promise<IMapPoint> {
  // const expectedResult: IPostMapPoint[] = []
  const bulkOps = []

  const { userId, ...realMapPoint } = userMapPoint

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
        update: { $set: userMapPoint },
        upsert: true
      }
    })
    // expectedResult.push(point)
  }

  // Execute the bulk write operations
  const bulkWriteResult = await mapCollection.bulkWrite(bulkOps)

  if (!bulkWriteResult.ok || bulkWriteResult.upsertedCount < 1 + Number(!!userId)) {
    throw new ErrorHandler(500, 'Map point was not upserted!')
  }

  const doc = bulkWriteResult.getRawResponse()
  // const result = expectedResult.map((mapPoint, i) => ({ ...mapPoint, _id: doc.upserted[i]._id }))

  return userId ? { ...userMapPoint, _id: doc.upserted[1]._id } : { ...realMapPoint, _id: doc.upserted[1]._id }
}

function _preparePoint(location: Location): IMapPoint {
  const point: IMapPoint = {
    _id: new ObjectId(),
    location,
    type: null,
    contentId: null
  }

  return point
}

async function generateMap(from: Location, to: Location) {
  const preparedPoints: IMapPoint[] = []

  for (let x = from.x; x <= to.x; x++) {
    for (let y = from.y; y < to.y; y++) {
      preparedPoints.push(_preparePoint({ x, y }))
    }
  }

  const result = await mapService.addMapPoints(preparedPoints)

  return result
}

export const mapService = { addMapPoints, generateMap, upsertMapPoint }
