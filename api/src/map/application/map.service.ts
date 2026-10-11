import { Item } from '../../crafting/domain/item.entity'
import { Clock } from '../../shared/application/clock'
import { IdGenerator } from '../../shared/application/id-generator'
import { UnitOfWork } from '../../persistence/application/unit-of-work'
import { cellsOf, compareLocations, locationKey, splitByChunk } from '../domain/location'
import { MapGenerator } from '../domain/map-generator'
import { KnownPoint, LocationRange, MapPoint } from '../domain/map-point.entity'

export class MapService {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly ids: IdGenerator,
    private readonly generator: MapGenerator,
    private readonly clock: Clock,
    private readonly chunkSize: number
  ) {}

  // A player looks at a range: missing cells of the real map are generated, and the player's knowledge of every cell
  // in the range becomes a fresh snapshot of the real cell. The range is worked chunk by chunk, so no step ever
  // needs more than one chunk of the map.
  observe(userId: string, range: LocationRange): Promise<KnownPoint[]> {
    return this.unitOfWork.run(async (repositories) => {
      const { map } = repositories
      const seenAt = this.clock.now().getTime()
      const snapshots: KnownPoint[] = []

      for (const part of splitByChunk(range, this.chunkSize)) {
        const real = new Map((await map.findPointsInRange(part)).map((point) => [locationKey(point.location), point]))
        const generated: MapPoint[] = []

        const items: Item[] = []

        for (const location of cellsOf(part)) {
          const key = locationKey(location)
          if (!real.has(key)) {
            const { point, item } = this.generator.generate(this.ids.next(), location, () => this.ids.next())
            generated.push(point)
            real.set(key, point)
            if (item) {
              items.push(item)
            }
          }
        }
        for (const item of items) {
          await repositories.items.add(item)
        }
        await map.addPoints(generated)

        const known = new Map(
          (await map.findKnownPointsInRange(userId, part)).map((point) => [locationKey(point.location), point])
        )
        const chunkSnapshots = [...real.entries()].map(([key, point]) => ({
          ...point,
          id: known.get(key)?.id ?? this.ids.next(),
          userId,
          seenAt
        }))
        await map.upsertKnownPoints(chunkSnapshots)
        snapshots.push(...chunkSnapshots)
      }

      return snapshots.sort((a, b) => compareLocations(a.location, b.location))
    })
  }
}
