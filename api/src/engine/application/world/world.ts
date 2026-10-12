import { BOT_TYPE } from '../../../../../lib/utils/interfaces/bots'
import { Heading, MapPointType } from '../../../../../lib/utils/interfaces/map'
import { RESOURCE } from '../../../../../lib/utils/interfaces/resources'
import { Result } from '../../../../../lib/utils/result'
import { Item } from '../../../crafting/domain/item.entity'
import { chunkOf, locationKey } from '../../../map/domain/location'
import { Location, MapPoint } from '../../../map/domain/map-point.entity'
import { EnergyModel } from '../../../modules/domain/energy-model'
import { GameModule } from '../../../modules/domain/game-module'
import { Module } from '../../../modules/domain/module.entity'
import { ModuleRegistry } from '../../../modules/domain/module-registry'
import { Rng } from '../../../shared/application/rng'
import { BotState } from '../../domain/bot-state'
import { WriteBehind } from '../write-behind'
import { StoredBot, WorldSource } from './world-source'

// A bot in the engine's memory. The state is replaced when its modules change.
export interface WorldBot {
  state: BotState
  position: Location | null
  heading: Heading
  carried: Item[]
}

const EMPTY_CELL = { type: null, contentId: null, resource: null } as const

// The engine's authoritative copy of the part of the world that is in use (design §12.2.2, §14.2): bots, cells and items
// are loaded on demand, changed in memory by one command at a time, and written behind. Because one thread applies the
// commands of a tick one after the other, the checks and changes of a command can never interleave with another's: a cell a
// bot moved into is occupied for the next command.
export class World {
  private bots = new Map<string, WorldBot>()
  private cells = new Map<string, MapPoint>()
  private items = new Map<string, Item>()
  private loadedChunks = new Set<string>()
  // Bots that are still moving, by the tick they are free again; kept across evictions
  private readonly busyUntil = new Map<string, number>()
  private rng: Rng | null = null
  private currentTick = 0

  constructor(
    private readonly source: WorldSource,
    private readonly writeBehind: WriteBehind,
    private readonly registry: ModuleRegistry,
    private readonly energy: EnergyModel,
    private readonly chunkSize: number,
    private readonly createRng: (seed: number) => Rng,
    private readonly seed: number
  ) {}

  get tick(): number {
    return this.currentTick
  }

  // A new tick begins: its random numbers come from the generator for this tick (design §12.4)
  beginTick(tick: number): void {
    this.currentTick = tick
    this.rng = this.createRng(this.seed ^ (tick * 0x9e3779b1))
  }

  random(): number {
    return (this.rng as Rng).next()
  }

  async bot(botId: string): Promise<WorldBot | null> {
    const cached = this.bots.get(botId)
    if (cached) {
      return cached
    }
    const stored: StoredBot | null = await this.source.loadBot(botId)
    if (!stored) {
      return null
    }
    const loaded = { ...stored, carried: [...stored.carried] }
    for (const item of loaded.carried) {
      this.items.set(item.id, item)
    }
    this.bots.set(botId, loaded)
    return loaded
  }

  get loadedBots(): WorldBot[] {
    return [...this.bots.values()]
  }

  modulesOf(bot: WorldBot): GameModule[] {
    return this.registry.instantiateAll(bot.state.modules)
  }

  // The cell at a location; one that was never generated is rolled now
  async cell(location: Location): Promise<MapPoint> {
    const key = locationKey(location)
    if (!this.cells.has(key)) {
      await this.loadChunk(location)
    }
    const existing = this.cells.get(key)
    if (existing) {
      return existing
    }
    const { point, item } = this.source.generate(location)
    this.cells.set(key, point)
    this.writeBehind.stageMapPoint(point)
    if (item) {
      this.items.set(item.id, item)
      this.writeBehind.stageItem(item)
    }
    return point
  }

  item(id: string): Item | undefined {
    return this.items.get(id)
  }

  hardnessOf(resource: RESOURCE): number {
    return this.source.hardnessOf(resource)
  }

  // Puts new content on a cell
  setCell(point: MapPoint): void {
    this.cells.set(locationKey(point.location), point)
    this.writeBehind.stageMapPoint(point)
  }

  emptyCell(point: MapPoint): void {
    this.setCell({ ...point, ...EMPTY_CELL })
  }

  // The bot stands on another cell: the old one is free, the new one is occupied
  async place(bot: WorldBot, to: Location): Promise<void> {
    const target = await this.cell(to)
    if (bot.position) {
      this.emptyCell(await this.cell(bot.position))
    }
    this.setCell({
      ...target,
      type: bot.state.bot.type === BOT_TYPE.BASE ? MapPointType.BASE : MapPointType.BOT,
      contentId: bot.state.bot.id,
      resource: null
    })
    bot.position = { ...to }
  }

  turn(bot: WorldBot, heading: Heading): void {
    bot.heading = heading
    this.writeBehind.stageHeading(bot.state.bot.id, heading)
  }

  // An item picked up, or dropped when `holder` is null
  setItemHolder(item: Item, holder: WorldBot | null): void {
    const updated: Item = { ...item, botId: holder?.state.bot.id ?? null }
    this.items.set(item.id, updated)
    this.writeBehind.stageItem(updated)
    for (const bot of this.bots.values()) {
      bot.carried = bot.carried.filter((carried) => carried.id !== item.id)
    }
    if (holder) {
      holder.carried = [...holder.carried, updated]
    }
  }

  // An item used up
  consumeItem(bot: WorldBot, item: Item): void {
    bot.carried = bot.carried.filter((carried) => carried.id !== item.id)
    this.items.delete(item.id)
    this.writeBehind.stageItemRemoval(item.id)
  }

  energyOf(bot: WorldBot): number {
    return this.energy.stored(bot.state.modules)
  }

  // The bot's modules, changed
  updateModules(bot: WorldBot, changed: readonly Module[]): void {
    const byId = new Map(changed.map((module) => [module.id, module]))
    bot.state = { ...bot.state, modules: bot.state.modules.map((module) => byId.get(module.id) ?? module) }
    changed.forEach((module) => this.writeBehind.stageModule(module))
  }

  // Pays an operation from the bot's batteries; NO_ENERGY when they cannot
  spend(bot: WorldBot, amount: number): Result {
    const paid = this.energy.spend(bot.state.modules, amount)
    if (!paid.ok) {
      return paid
    }
    this.updateModules(
      bot,
      paid.data.filter((module) => !bot.state.modules.includes(module))
    )
    return { ok: true, data: undefined }
  }

  isBusy(botId: string): boolean {
    return (this.busyUntil.get(botId) ?? 0) > this.currentTick
  }

  keepBusy(botId: string, ticks: number): void {
    this.busyUntil.set(botId, this.currentTick + ticks)
  }

  // Idle drain, generators and live scanners of every bot in memory, once per tick after the commands (design §12.5)
  tickEnergy(now: number): void {
    for (const bot of this.bots.values()) {
      const { modules } = this.energy.tick(bot.state.modules, now)
      this.updateModules(
        bot,
        modules.filter((module) => !bot.state.modules.includes(module))
      )
    }
  }

  // Writes what changed behind, before something else reads the database
  async sync(): Promise<void> {
    await this.writeBehind.flush(this.currentTick)
  }

  // Forgets everything loaded, after something else changed the database; call `sync` first
  evict(): void {
    this.bots = new Map()
    this.cells = new Map()
    this.items = new Map()
    this.loadedChunks = new Set()
  }

  private async loadChunk(location: Location): Promise<void> {
    const { cx, cy } = chunkOf(location, this.chunkSize)
    const key = `${cx}:${cy}:${location.z}`
    if (this.loadedChunks.has(key)) {
      return
    }
    const { points, items } = await this.source.loadCells({
      from: { x: cx * this.chunkSize, y: cy * this.chunkSize, z: location.z },
      to: { x: (cx + 1) * this.chunkSize - 1, y: (cy + 1) * this.chunkSize - 1, z: location.z }
    })
    for (const point of points) {
      // A change made in memory since the chunk was read is newer than the row
      this.cells.set(locationKey(point.location), this.cells.get(locationKey(point.location)) ?? point)
    }
    for (const item of items) {
      this.items.set(item.id, this.items.get(item.id) ?? item)
    }
    this.loadedChunks.add(key)
  }
}
