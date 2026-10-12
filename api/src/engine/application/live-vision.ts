import { MapPointType } from '../../../../lib/utils/interfaces/map'
import { KnownPoint, MapPoint, Location } from '../../map/domain/map-point.entity'
import { chunkKeyOf, locationKey } from '../../map/domain/location'
import { ScannerModule } from '../../modules/domain/scanner-module'
import { IdGenerator } from '../../shared/application/id-generator'
import { areaCells, areaChunks, areaContains, LiveArea } from '../domain/live-area'
import { EngineSink } from './engine-ports'
import { World } from './world/world'
import { WorldSource } from './world/world-source'
import { WriteBehind } from './write-behind'

// A cell of a live view
export interface VisionCell {
  x: number
  y: number
  z: number
  type: MapPointType | null
  contentId: string | null
  resource: MapPoint['resource']
  seenAt: number
}

interface Area extends LiveArea {
  // The ticks between two batches of changes, and when the next one is due
  readonly delayTicks: number
  nextDelivery: number
  // Changes since the last batch, by cell
  pending: Map<string, VisionCell>
}

interface KnownCell {
  point: KnownPoint
  // The tick the cell last changed at, for `view(since)`
  changedAt: number
}

const toCell = ({ location, type, contentId, resource, seenAt }: KnownPoint): VisionCell => ({
  x: location.x,
  y: location.y,
  z: location.z,
  type,
  contentId,
  resource,
  seenAt
})

const sameContent = (a: MapPoint, b: MapPoint) =>
  a.type === b.type &&
  a.contentId === b.contentId &&
  a.resource?.resource === b.resource?.resource &&
  a.resource?.amount === b.resource?.amount

// Live vision (design §4.4): a scanner in live mode keeps the cells around its bot current in its owner's knowledge. It is a
// subscription, not polling: the engine already knows every cell that changes in a tick, an index of live areas by chunk hands
// each one to the areas that cover it, and the changes are sent in batches every scanner `delay`. When a bot moves only the
// cells at the edge of its area are looked at. A live cell is as fresh as the moment you look at it, so its `seenAt` is not
// kept up to date: it is written when the cell's content changes and, stamped with that moment, when it stops being live.
export class LiveVision {
  private readonly areas = new Map<string, Area>()
  private readonly index = new Map<string, Set<string>>()
  private readonly liveBots = new Set<string>()
  private known = new Map<string, KnownCell>()
  private lastNow = 0
  private mustLookAgain = false
  private readonly loadedKnown = new Set<string>()

  constructor(
    private readonly world: World,
    private readonly source: Pick<WorldSource, 'loadKnown' | 'liveScannerBotIds'>,
    private readonly writeBehind: WriteBehind,
    private readonly ids: IdGenerator,
    private readonly sink: EngineSink,
    private readonly tickIntervalMs: number,
    private readonly chunkSize: number
  ) {
    world.onEvict(() => this.forgetKnowledge())
  }

  // After a restart: the bots that had a live scanner see again
  async restore(): Promise<void> {
    for (const botId of await this.source.liveScannerBotIds()) {
      this.liveBots.add(botId)
    }
  }

  // A scanner of the bot was switched on
  track(botId: string): void {
    this.liveBots.add(botId)
  }

  // The players who see a cell, whoever caused what happens there (design §24.1)
  audienceAt(location: Location): string[] {
    const users = new Set<string>()
    for (const id of this.index.get(chunkKeyOf(location, this.chunkSize)) ?? []) {
      const area = this.areas.get(id) as Area
      if (areaContains(area, location)) {
        users.add(area.userId)
      }
    }
    return [...users].sort()
  }

  get areaCount(): number {
    return this.areas.size
  }

  // What the live scanner sees: all of its area, or only what changed after tick `since`
  async view(scannerId: string, since?: number): Promise<{ tick: number; cells: VisionCell[] }> {
    const area = this.areas.get(scannerId)
    const cells: VisionCell[] = []
    if (area) {
      for (const location of areaCells(area)) {
        const cell = await this.knownCell(area.userId, location)
        if (cell && (since === undefined || cell.changedAt > since)) {
          cells.push(toCell({ ...cell.point, seenAt: this.lastNow }))
        }
      }
    }
    return { tick: this.world.tick, cells }
  }

  // Once per tick, after the commands and the energy of the tick: brings the areas up to date with the bots, hands the cells that
  // changed to the areas that cover them, and sends the batches that are due
  async refresh(tick: number, now: number): Promise<void> {
    this.lastNow = now
    await this.syncAreas(tick, now)
    if (this.mustLookAgain) {
      this.mustLookAgain = false
      for (const area of this.areas.values()) {
        for (const location of areaCells(area)) {
          await this.observe(area, await this.world.cell(location), now, tick)
        }
      }
    }
    for (const point of this.world.drainChanged()) {
      for (const id of this.index.get(chunkKeyOf(point.location, this.chunkSize)) ?? []) {
        const area = this.areas.get(id) as Area
        if (areaContains(area, point.location)) {
          await this.observe(area, point, now, tick)
        }
      }
    }
    for (const area of this.areas.values()) {
      if (tick >= area.nextDelivery) {
        this.deliver(area, tick)
      }
    }
  }

  private async syncAreas(tick: number, now: number): Promise<void> {
    const wanted = new Map<string, LiveArea & { delayTicks: number }>()
    for (const botId of [...this.liveBots].sort()) {
      const bot = await this.world.bot(botId)
      const live = bot?.position
        ? this.world
            .modulesOf(bot)
            .filter(
              (module): module is ScannerModule => module instanceof ScannerModule && module.isWorking && module.isLive
            )
        : []
      if (!bot?.position || !live.length) {
        this.liveBots.delete(botId)
        continue
      }
      for (const scanner of live) {
        wanted.set(scanner.id, {
          scannerId: scanner.id,
          botId,
          userId: bot.state.ownerId,
          center: bot.position,
          radius: scanner.distance,
          delayTicks: Math.max(1, Math.ceil(scanner.delay / this.tickIntervalMs))
        })
      }
    }

    for (const id of [...this.areas.keys()]) {
      if (!wanted.has(id)) {
        await this.remove(this.areas.get(id) as Area, now)
      }
    }
    for (const next of wanted.values()) {
      const current = this.areas.get(next.scannerId)
      if (!current) {
        await this.add(
          { ...next, nextDelivery: tick + next.delayTicks, pending: new Map() },
          areaCells(next),
          tick,
          now
        )
      } else if (
        current.center.x !== next.center.x ||
        current.center.y !== next.center.y ||
        current.center.z !== next.center.z ||
        current.radius !== next.radius
      ) {
        await this.move(current, next, tick, now)
      }
    }
  }

  private async add(area: Area, entering: Location[], tick: number, now: number): Promise<void> {
    this.areas.set(area.scannerId, area)
    this.indexArea(area)
    for (const location of entering) {
      await this.observe(area, await this.world.cell(location), now, tick)
    }
  }

  // The bot moved: the cells at the new edge are looked at, the cells left behind stop being live
  private async move(area: Area, next: LiveArea, tick: number, now: number): Promise<void> {
    const before = area
    this.unindexArea(before)
    const moved: Area = { ...area, center: next.center, radius: next.radius }
    this.areas.set(area.scannerId, moved)
    this.indexArea(moved)
    for (const location of areaCells(moved).filter((cell) => !areaContains(before, cell))) {
      await this.observe(moved, await this.world.cell(location), now, tick)
    }
    for (const location of areaCells(before).filter((cell) => !areaContains(moved, cell))) {
      this.release(before.userId, location, moved.scannerId, now)
    }
  }

  private async remove(area: Area, now: number): Promise<void> {
    this.areas.delete(area.scannerId)
    this.unindexArea(area)
    for (const location of areaCells(area)) {
      this.release(area.userId, location, area.scannerId, now)
    }
  }

  // The player's knowledge of a cell becomes what the cell is now
  private async observe(area: Area, point: MapPoint, now: number, tick: number): Promise<void> {
    const key = locationKey(point.location)
    const current = await this.knownCell(area.userId, point.location)
    const changed = !current || !sameContent(current.point, point)
    const known: KnownPoint = {
      ...point,
      id: current?.point.id ?? this.ids.next(),
      userId: area.userId,
      seenAt: now
    }
    this.known.set(`${area.userId}|${key}`, {
      point: known,
      changedAt: changed ? tick : (current?.changedAt as number)
    })
    if (changed) {
      this.writeBehind.stageKnownPoint(known)
      area.pending.set(key, toCell(known))
    }
  }

  // A cell no longer in this area: unless another area of the player still covers it, it becomes a snapshot stamped with the
  // last moment it was live, which is written now
  private release(userId: string, location: Location, exceptScannerId: string, now: number): void {
    const covered = [...(this.index.get(chunkKeyOf(location, this.chunkSize)) ?? [])].some((id) => {
      const other = this.areas.get(id) as Area
      return id !== exceptScannerId && other.userId === userId && areaContains(other, location)
    })
    const cell = this.known.get(`${userId}|${locationKey(location)}`)
    if (!covered && cell) {
      cell.point = { ...cell.point, seenAt: now }
      this.writeBehind.stageKnownPoint(cell.point)
    }
  }

  private deliver(area: Area, tick: number): void {
    area.nextDelivery = tick + area.delayTicks
    if (!area.pending.size) {
      return
    }
    const cells = [...area.pending.values()]
    area.pending = new Map()
    this.sink.emit({
      type: 'vision',
      userId: area.userId,
      botId: area.botId,
      scannerId: area.scannerId,
      tick,
      cells
    })
  }

  private async knownCell(userId: string, location: Location): Promise<KnownCell | undefined> {
    const chunk = `${userId}|${chunkKeyOf(location, this.chunkSize)}`
    if (!this.loadedKnown.has(chunk)) {
      this.loadedKnown.add(chunk)
      const size = this.chunkSize
      const cx = Math.floor(location.x / size)
      const cy = Math.floor(location.y / size)
      const points = await this.source.loadKnown(userId, {
        from: { x: cx * size, y: cy * size, z: location.z },
        to: { x: (cx + 1) * size - 1, y: (cy + 1) * size - 1, z: location.z }
      })
      for (const point of points) {
        const key = `${userId}|${locationKey(point.location)}`
        if (!this.known.has(key)) {
          this.known.set(key, { point, changedAt: 0 })
        }
      }
    }
    return this.known.get(`${userId}|${locationKey(location)}`)
  }

  private indexArea(area: Area): void {
    for (const chunk of areaChunks(area, this.chunkSize)) {
      this.index.set(chunk, (this.index.get(chunk) ?? new Set<string>()).add(area.scannerId))
    }
  }

  private unindexArea(area: Area): void {
    for (const chunk of areaChunks(area, this.chunkSize)) {
      const ids = this.index.get(chunk)
      ids?.delete(area.scannerId)
      if (ids && !ids.size) {
        this.index.delete(chunk)
      }
    }
  }

  // The world was evicted because something else changed the database: what the engine remembers of the players' knowledge may be
  // stale, so it is dropped and the live areas are looked at again on the next tick. Changes were written before.
  private forgetKnowledge(): void {
    this.known = new Map()
    this.loadedKnown.clear()
    this.mustLookAgain = true
  }
}
