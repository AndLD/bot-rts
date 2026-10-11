import { IMapPoint } from '../../../../lib/utils/interfaces/map'
import { KnownPoint, MapPoint } from '../domain/map-point.entity'

export function toMapPointDto(point: MapPoint | KnownPoint): IMapPoint {
  const { x, y, z } = point.location
  const dto: IMapPoint = {
    _id: point.id,
    location: z === 0 ? { x, y } : { x, y, z },
    contentId: point.contentId,
    type: point.type
  }

  if ('userId' in point) {
    dto.userId = point.userId
    dto.seenAt = point.seenAt
  }

  return dto
}
