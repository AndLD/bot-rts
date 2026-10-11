import { MapRepository } from '../../map/application/map.repository'
import { Location } from '../../map/domain/map-point.entity'
import { Clock } from '../../shared/application/clock'
import { Rng } from '../../shared/application/rng'
import { SpawnConfig } from '../domain/spawn-config'
import { NoFreeLocationError, SpawnSeedClosedError, SpawnSeedFullError } from '../domain/spawn.errors'
import { normalizeSeedCode } from '../domain/spawn-seed'
import { SpawnSeedRepository } from './spawn-seed.repository'

const HOUR_MS = 3600 * 1000

// The repositories placement reads and writes; inside a transaction these are the transaction's
export interface SpawnRepositories {
  map: MapRepository
  spawnSeeds: SpawnSeedRepository
}

// Where a new base goes, and the seed it belongs to if the player used one
export interface BaseSpawn {
  readonly location: Location
  readonly seed: { readonly code: string; readonly isNew: boolean } | null
}

const NEIGHBOURS = [-1, 0, 1].flatMap((dx) => [-1, 0, 1].map((dy) => ({ dx, dy }))).filter(({ dx, dy }) => dx || dy)

// Placement of new bases (design §4.1, §22.3) and of assembled bots (§8.3)
export class SpawnService {
  constructor(
    private readonly rng: Rng,
    private readonly clock: Clock,
    private readonly config: SpawnConfig
  ) {}

  // A free cell for the base of `userId` that keeps `minBaseDistance` from every base, living or corpse. With a seed
  // code the player starts near the seed's other players instead (exempt from the distance to them only).
  async chooseBaseLocation(
    repositories: SpawnRepositories,
    input: { userId: string; seedCode?: string }
  ): Promise<BaseSpawn> {
    if (!input.seedCode) {
      return {
        location: await this.pick(repositories.map, await this.ringArea(repositories.map), new Set()),
        seed: null
      }
    }

    const code = normalizeSeedCode(input.seedCode)
    const seed = await repositories.spawnSeeds.find(code)
    if (!seed) {
      return {
        location: await this.pick(repositories.map, await this.ringArea(repositories.map), new Set()),
        seed: { code, isNew: true }
      }
    }

    const members = await repositories.spawnSeeds.membersOf(code)
    if (this.clock.now().getTime() - seed.createdAt.getTime() > this.config.seedTtlHours * HOUR_MS) {
      throw new SpawnSeedClosedError()
    }
    if (members.length >= this.config.seedMaxPlayers && !members.some((member) => member.userId === input.userId)) {
      throw new SpawnSeedFullError()
    }

    const area = { center: seed.anchor, radius: this.config.seedRadius }
    const location = await this.pick(repositories.map, area, new Set(members.map((member) => member.baseId)))
    return { location, seed: { code, isNew: false } }
  }

  // Remembers that the base started from the seed: the first one sets the anchor
  async joinSeed(repositories: SpawnRepositories, spawn: BaseSpawn, member: { userId: string; baseId: string }) {
    if (!spawn.seed) {
      return
    }
    if (spawn.seed.isNew) {
      await repositories.spawnSeeds.add({
        code: spawn.seed.code,
        anchor: spawn.location,
        createdAt: this.clock.now()
      })
    }
    await repositories.spawnSeeds.saveMember({ seedCode: spawn.seed.code, ...member })
  }

  // A free cell next to a base for a bot that was just assembled, picked at random among the free ones
  async findAdjacentCell(repositories: Pick<SpawnRepositories, 'map'>, around: Location): Promise<Location> {
    const free: Location[] = []
    for (const { dx, dy } of NEIGHBOURS) {
      const cell = { x: around.x + dx, y: around.y + dy, z: around.z }
      if (await this.isFree(repositories.map, cell)) {
        free.push(cell)
      }
    }

    if (!free.length) {
      throw new NoFreeLocationError('No free cell next to the base')
    }
    return free[this.randomInt(0, free.length - 1)]
  }

  // The area new players are drawn in: it grows with the number of bases
  private async ringArea(map: MapRepository) {
    const bases = await map.countBases()
    return { center: { x: 0, y: 0, z: 0 }, radius: this.config.radius + this.config.radiusPerBase * bases }
  }

  private async pick(map: MapRepository, area: { center: Location; radius: number }, exempt: ReadonlySet<string>) {
    for (let attempt = 0; attempt < this.config.attempts; attempt += 1) {
      const candidate = {
        x: area.center.x + this.randomInt(-area.radius, area.radius),
        y: area.center.y + this.randomInt(-area.radius, area.radius),
        z: 0
      }
      if ((await this.isFree(map, candidate)) && (await this.isFarFromBases(map, candidate, exempt))) {
        return candidate
      }
    }
    throw new NoFreeLocationError()
  }

  // Not occupied and not a deposit: nothing solid and no item that the base would cover
  private async isFree(map: MapRepository, cell: Location): Promise<boolean> {
    const [point] = await map.findPointsInRange({ from: cell, to: cell })
    return !point || point.type === null
  }

  private async isFarFromBases(map: MapRepository, cell: Location, exempt: ReadonlySet<string>): Promise<boolean> {
    const reach = this.config.minBaseDistance - 1
    const near = await map.findBasePointsInRange({
      from: { x: cell.x - reach, y: cell.y - reach, z: cell.z },
      to: { x: cell.x + reach, y: cell.y + reach, z: cell.z }
    })
    return near.every((point) => point.contentId !== null && exempt.has(point.contentId))
  }

  private randomInt(min: number, max: number): number {
    return min + Math.floor(this.rng.next() * (max - min + 1))
  }
}
