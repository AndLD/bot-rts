import { BOT_TYPE } from '../../../../../lib/utils/interfaces/bots'
import { ENGINE_COUNTER, MetricRecorder, NO_RECORDER } from '../engine-metrics'
import { Heading, MapPointType } from '../../../../../lib/utils/interfaces/map'
import { RESOURCE } from '../../../../../lib/utils/interfaces/resources'
import { Result } from '../../../../../lib/utils/result'
import { Item } from '../../../crafting/domain/item.entity'
import { chunkKeyOf, chunkOf, locationKey } from '../../../map/domain/location'
import { Location, MapPoint } from '../../../map/domain/map-point.entity'
import { EnergyEvent, EnergyModel } from '../../../modules/domain/energy-model'
import { GameModule, WirelessAdapterModule } from '../../../modules/domain/game-module'
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
  // When each loaded chunk was last used (a tick), the cells it holds, and which chunks have changes the database lacks
  private readonly chunkUse = new Map<string, number>()
  private chunkCells = new Map<string, Set<string>>()
  private readonly dirtyChunks = new Set<string>()
  // The cells that changed since the live views last asked, newest content per cell
  private changed = new Map<string, MapPoint>()
  private readonly evictionListeners: Array<() => void> = []
  private readonly botChangeListeners: Array<(ownerId: string) => void> = []
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
    private readonly seed: number,
    // How many chunks of cells stay in memory; the least recently used go first (design §4.4)
    private readonly maxChunks: number,
    // Counts the cells and bots found in memory and those loaded (the cache hit rate of the console)
    private readonly recorder: MetricRecorder = NO_RECORDER
  ) {
    // A batch the database refused is gone: what is in memory may differ from what is stored, so start from the database
    writeBehind.onDiscard(() => this.evict())
  }

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
      this.recorder.count(ENGINE_COUNTER.cacheHits)
      return cached
    }
    this.recorder.count(ENGINE_COUNTER.cacheMisses)
    const stored: StoredBot | null = await this.source.loadBot(botId)
    if (!stored) {
      return null
    }
    const loaded = { ...stored, carried: [...stored.carried] }
    this.botChanged(loaded)
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
    const chunk = chunkKeyOf(location, this.chunkSize)
    this.chunkUse.set(chunk, this.currentTick)
    if (this.cells.has(key)) {
      this.recorder.count(ENGINE_COUNTER.cacheHits)
    } else {
      this.recorder.count(ENGINE_COUNTER.cacheMisses)
      await this.loadChunk(location)
    }
    const existing = this.cells.get(key)
    if (existing) {
      return existing
    }
    const { point, item } = this.source.generate(location)
    this.holdCell(point, chunk)
    this.writeBehind.stageMapPoint(point)
    this.dirtyChunks.add(chunk)
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
    const key = locationKey(point.location)
    const chunk = chunkKeyOf(point.location, this.chunkSize)
    this.holdCell(point, chunk)
    this.changed.set(key, point)
    this.dirtyChunks.add(chunk)
    this.writeBehind.stageMapPoint(point)
  }

  // The cells that changed since the last call, for the live views (design §4.4)
  drainChanged(): MapPoint[] {
    const points = [...this.changed.values()]
    this.changed = new Map()
    return points
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
    this.botChanged(bot)
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

  // The energy the bot can use now: none while it is unpowered (design §12.5)
  energyOf(bot: WorldBot): number {
    return this.energy.available(bot.state.modules)
  }

  // The bot's modules, changed
  updateModules(bot: WorldBot, changed: readonly Module[]): void {
    const before = this.radioSignature(bot)
    const byId = new Map(changed.map((module) => [module.id, module]))
    bot.state = { ...bot.state, modules: bot.state.modules.map((module) => byId.get(module.id) ?? module) }
    changed.forEach((module) => this.writeBehind.stageModule(module))
    if (this.radioSignature(bot) !== before) {
      this.botChanged(bot)
    }
  }

  // Told when a bot is loaded, moves, or changes in a way that matters to the radio network (design §11.2.1): its adapter, or
  // whether it has energy
  onBotChange(listener: (ownerId: string) => void): void {
    this.botChangeListeners.push(listener)
  }

  private botChanged(bot: WorldBot): void {
    this.botChangeListeners.forEach((listener) => listener(bot.state.ownerId))
  }

  private radioSignature(bot: WorldBot): string {
    const adapter = this.registry
      .instantiateAll(bot.state.modules)
      .find((module): module is WirelessAdapterModule => module instanceof WirelessAdapterModule && module.isOnline)
    return `${adapter ? adapter.range : 'off'}|${!this.energy.isDepleted(bot.state.modules)}`
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
  tickEnergy(now: number): Array<{ bot: WorldBot; event: EnergyEvent }> {
    const told: Array<{ bot: WorldBot; event: EnergyEvent }> = []
    for (const bot of this.bots.values()) {
      const { modules, events } = this.energy.tick(bot.state.modules, now)
      this.updateModules(
        bot,
        modules.filter((module) => !bot.state.modules.includes(module))
      )
      events.forEach((event) => told.push({ bot, event }))
    }
    return told
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
    this.chunkCells = new Map()
    this.chunkUse.clear()
    this.dirtyChunks.clear()
    this.evictionListeners.forEach((listener) => listener())
  }

  // Told when everything loaded is forgotten, so that a cache built on it can start afresh too
  onEvict(listener: () => void): void {
    this.evictionListeners.push(listener)
  }

  // Keeps at most `maxChunks` chunks of cells: the least recently used go, but never one with changes that are not written
  evictCold(): void {
    if (!this.writeBehind.pending) {
      this.dirtyChunks.clear()
    }
    const candidates = [...this.loadedChunks]
      .filter((chunk) => !this.dirtyChunks.has(chunk))
      .sort((a, b) => (this.chunkUse.get(a) as number) - (this.chunkUse.get(b) as number))
    for (const chunk of candidates.slice(0, Math.max(this.loadedChunks.size - this.maxChunks, 0))) {
      for (const key of this.chunkCells.get(chunk) as Set<string>) {
        this.cells.delete(key)
      }
      this.chunkCells.delete(chunk)
      this.chunkUse.delete(chunk)
      this.loadedChunks.delete(chunk)
    }
  }

  get loadedChunkCount(): number {
    return this.loadedChunks.size
  }

  private async loadChunk(location: Location): Promise<void> {
    const { cx, cy } = chunkOf(location, this.chunkSize)
    const key = chunkKeyOf(location, this.chunkSize)
    if (this.loadedChunks.has(key)) {
      return
    }
    const { points, items } = await this.source.loadCells({
      from: { x: cx * this.chunkSize, y: cy * this.chunkSize, z: location.z },
      to: { x: (cx + 1) * this.chunkSize - 1, y: (cy + 1) * this.chunkSize - 1, z: location.z }
    })
    for (const point of points) {
      // A change made in memory since the chunk was read is newer than the row
      this.holdCell(this.cells.get(locationKey(point.location)) ?? point, key)
    }
    for (const item of items) {
      this.items.set(item.id, this.items.get(item.id) ?? item)
    }
    this.loadedChunks.add(key)
    this.chunkCells.set(key, this.chunkCells.get(key) ?? new Set<string>())
  }

  private holdCell(point: MapPoint, chunk: string): void {
    const key = locationKey(point.location)
    this.cells.set(key, point)
    const held = this.chunkCells.get(chunk) ?? new Set<string>()
    this.chunkCells.set(chunk, held.add(key))
  }
}
