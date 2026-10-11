import { MapPointType } from '../../../../lib/utils/interfaces/map'
import { Clock } from '../../shared/application/clock'
import { IdGenerator } from '../../shared/application/id-generator'
import { Rng } from '../../shared/application/rng'
import { UnitOfWork } from '../../persistence/application/unit-of-work'
import { KnownPoint, LocationRange, MapPoint } from '../domain/map-point.entity'
import { WorldConfig } from '../domain/world-config'

export class MapService {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly ids: IdGenerator,
    private readonly rng: Rng,
    private readonly clock: Clock,
    private readonly world: WorldConfig
  ) {}

  // A player looks at a range: missing cells of the real map are generated, and the player's knowledge of every cell
  // in the range becomes a fresh snapshot of the real cell
  observe(userId: string, range: LocationRange): Promise<KnownPoint[]> {
    return this.unitOfWork.run(async ({ map }) => {
      const real = new Map((await map.findPointsInRange(range)).map((point) => [cellKey(point), point]))
      const generated: MapPoint[] = []

      for (const location of cellsOf(range)) {
        const key = cellKey({ location })
        if (!real.has(key)) {
          const point = this.generatePoint(location)
          generated.push(point)
          real.set(key, point)
        }
      }
      await map.addPoints(generated)

      const known = new Map((await map.findKnownPointsInRange(userId, range)).map((point) => [cellKey(point), point]))
      const seenAt = this.clock.now().getTime()
      const snapshots = [...real.entries()].map(([key, point]) => ({
        ...point,
        id: known.get(key)?.id ?? this.ids.next(),
        userId,
        seenAt
      }))
      await map.upsertKnownPoints(snapshots)

      return snapshots
    })
  }

  private generatePoint(location: MapPoint['location']): MapPoint {
    return {
      id: this.ids.next(),
      location,
      type: this.rng.next() < this.world.resourceChance ? MapPointType.RESOURCE : null,
      contentId: null
    }
  }
}

function cellKey({ location }: { location: MapPoint['location'] }): string {
  return `${location.x}:${location.y}:${location.z}`
}

function* cellsOf({ from, to }: LocationRange) {
  for (let x = from.x; x <= to.x; x += 1) {
    for (let y = from.y; y <= to.y; y += 1) {
      for (let z = from.z; z <= to.z; z += 1) {
        yield { x, y, z }
      }
    }
  }
}
