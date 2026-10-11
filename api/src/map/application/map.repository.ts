import { KnownPoint, Location, LocationRange, MapPoint } from '../domain/map-point.entity'

export const MAP_REPOSITORY = Symbol('MapRepository')

export interface MapRepository {
  // Real layer
  findPointsInRange(range: LocationRange): Promise<MapPoint[]>
  findPointByContentId(contentId: string): Promise<MapPoint | null>
  addPoints(points: MapPoint[]): Promise<void>
  // Inserts the point, or replaces type and content of the point at the same location
  upsertPoint(point: MapPoint): Promise<MapPoint>
  // Per-player knowledge
  findKnownPointsInRange(userId: string, range: LocationRange): Promise<KnownPoint[]>
  upsertKnownPoints(points: KnownPoint[]): Promise<void>
  findKnownPoint(userId: string, location: Location): Promise<KnownPoint | null>
}
