import { GameTimeConfig, sunlightOf } from '../../../../lib/utils/game-time'
import { EngineType, ModuleType } from '../../../../lib/utils/interfaces/modules'
import { IResourceStack, RESOURCES } from '../../../../lib/utils/interfaces/resources'
import { fail, ok, Result, ResultCode } from '../../../../lib/utils/result'
import { Module } from './module.entity'

// The size of a class-1 memory module (design §11.4)
export const DEFAULT_DRIVE_QUOTA_BYTES = 64 * 1024

// A module as the game rules see it: the stored record plus the typed meaning of its type-specific properties. Each
// type is a subclass, so new behaviour of a type goes into its class and nowhere else (docs/engineering/method.md §2).
export abstract class GameModule {
  constructor(readonly record: Module) {}

  get id(): string {
    return this.record.id
  }

  get botId(): string {
    return this.record.botId
  }

  get type(): ModuleType {
    return this.record.type
  }

  get name(): string {
    return this.record.name
  }

  // A module with no condition left is broken: it stays attached but does nothing (design §8.4.1)
  get isWorking(): boolean {
    return this.record.condition > 0
  }

  // The rule every action starts with: a broken module does nothing (design §8.4.1)
  ensureWorking(): Result {
    return this.isWorking ? ok() : fail(ResultCode.BROKEN_MODULE, `The module ${this.name} is broken`)
  }

  // The record with some properties replaced; the stored state of a module changes only through such copies
  withProps(patch: Record<string, unknown>): Module {
    return { ...this.record, props: { ...this.record.props, ...patch } }
  }

  // A numeric property, or the fallback when it is missing or not a usable number
  protected number(key: string, fallback: number): number {
    const value = Number(this.record.props[key])
    return this.record.props[key] !== undefined && Number.isFinite(value) && value >= 0 ? value : fallback
  }

  protected flag(key: string, fallback: boolean): boolean {
    const value = this.record.props[key]
    return typeof value === 'boolean' ? value : fallback
  }

  protected text(key: string, fallback: string): string {
    const value = this.record.props[key]
    return typeof value === 'string' ? value : fallback
  }
}

// A memory module is a drive (design §11.4)
export class DriveModule extends GameModule {
  // Bytes
  get quota(): number {
    return this.number('quota', DEFAULT_DRIVE_QUOTA_BYTES)
  }

  get readDelay(): number {
    return this.number('readDelay', 0)
  }

  get writeDelay(): number {
    return this.number('writeDelay', 0)
  }
}

export class ProcessorModule extends GameModule {
  get delay(): number {
    return this.number('delay', 0)
  }

  // Script operations per tick (design §12.2.1)
  get opsPerTick(): number {
    return this.number('opsPerTick', 1)
  }

  get parallelExecutions(): number {
    return this.number('parallelExecutions', 1)
  }
}

// The control block: the bot's identity and its radio link (design §11.2.1)
export class WirelessAdapterModule extends GameModule {
  // Range in cells
  get range(): number {
    return this.number('range', 0)
  }

  get isConnected(): boolean {
    return this.flag('isConnected', false)
  }

  // Whether the bot can take part in radio traffic at all
  get isOnline(): boolean {
    return this.isWorking && this.isConnected
  }
}

export class BatteryModule extends GameModule {
  get capacity(): number {
    return this.number('capacity', 0)
  }

  get voltage(): number {
    return this.number('voltage', 0)
  }

  // The stored energy, never above the capacity
  get value(): number {
    return Math.min(this.number('value', 0), this.capacity)
  }

  get isConnected(): boolean {
    return this.flag('isConnected', true)
  }

  // Whether the player was told that the energy is low; it stays set until the energy is not low any more
  get isLowReported(): boolean {
    return this.flag('isLowReported', false)
  }

  // Whether the bot ran out of energy and has not grown the stored energy back to the resume threshold since; it stays set
  // until it has (design §12.5), so a bot at the edge does not flap between working and out of energy
  get isUnpowered(): boolean {
    return this.flag('isUnpowered', false)
  }

  // The energy after taking `amount` out; an empty battery refuses and keeps its charge (design §12.5)
  discharge(amount: number): Result<number> {
    const working = this.ensureWorking()
    if (!working.ok) {
      return working
    }
    if (amount > this.value) {
      return fail(ResultCode.NO_ENERGY, 'Not enough energy')
    }
    return ok(this.value - amount)
  }

  // The energy after adding `amount`, capped at the capacity
  charge(amount: number): number {
    return Math.min(this.value + amount, this.capacity)
  }
}

// Makes energy for the battery in cycles (design §7.2.1, §12.5). What a cycle burns and how much it makes is up to the kind
// of source; the energy model runs every kind the same way.
export abstract class PowerSourceModule extends GameModule {
  get delay(): number {
    return this.number('delay', 0)
  }

  // Energy added to the battery by one cycle at full output
  get energyPerCycle(): number {
    return this.number('energyPerCycle', 0)
  }

  // The oil one cycle burns from the bot's storage; none for a source that needs no fuel
  get fuelPerCycle(): number {
    return 0
  }

  // Whether the source ran out of fuel and the player was told; it stays set until it runs on fuel again (never for a
  // source that needs none)
  get isOutOfFuel(): boolean {
    return this.flag('isOutOfFuel', false)
  }

  // Share of `energyPerCycle` made at the given game time, from 0 to 1
  abstract outputAt(timestampMs: number, time: GameTimeConfig): number

  // When the last cycle was due, in ms of the game clock; unset until the source first runs
  get lastCycleAt(): number | undefined {
    return this.record.props.lastCycleAt === undefined ? undefined : this.number('lastCycleAt', 0)
  }

  // Switching on starts the cycles from now, so a source that was off does not catch up
  enable(now: number): Result<{ patch: Record<string, unknown> }> {
    const working = this.ensureWorking()
    return working.ok ? ok({ patch: { isEnabled: true, lastCycleAt: now } }) : working
  }

  // Always possible, so that a broken source can still be switched off
  disable(): { patch: Record<string, unknown> } {
    return { patch: { isEnabled: false } }
  }

  get isEnabled(): boolean {
    return this.flag('isEnabled', false)
  }
}

// Burns oil from the bot's storage; full output day and night
export class GeneratorModule extends PowerSourceModule {
  override get fuelPerCycle(): number {
    return this.number('fuelPerCycle', 0)
  }

  outputAt(): number {
    return 1
  }
}

// Needs no fuel; its output follows the sunlight of the time of day
export class SolarPanelModule extends PowerSourceModule {
  outputAt(timestampMs: number, time: GameTimeConfig): number {
    return sunlightOf(timestampMs, time)
  }
}

export class StorageModule extends GameModule {
  get capacity(): number {
    return this.number('capacity', 0)
  }

  // What the box holds; stacks of unknown resources or unusable amounts are not counted
  get items(): IResourceStack[] {
    const raw = this.record.props.items
    if (!Array.isArray(raw)) {
      return []
    }
    return raw.filter(
      (stack): stack is IResourceStack =>
        RESOURCES.includes(stack?.resource) && Number.isFinite(stack.amount) && stack.amount > 0
    )
  }

  get used(): number {
    return this.items.reduce((sum, stack) => sum + stack.amount, 0)
  }

  get free(): number {
    return Math.max(this.capacity - this.used, 0)
  }

  amountOf(resource: IResourceStack['resource']): number {
    return this.items.find((stack) => stack.resource === resource)?.amount ?? 0
  }

  // The contents after putting `stack` in; refuses what does not fit
  add(stack: IResourceStack): Result<IResourceStack[]> {
    const working = this.ensureWorking()
    if (!working.ok) {
      return working
    }
    if (stack.amount > this.free) {
      return fail(ResultCode.NO_SPACE, 'The storage is full')
    }
    return ok(withAmount(this.items, stack.resource, this.amountOf(stack.resource) + stack.amount))
  }

  // The contents after taking `stack` out; refuses what is not there
  remove(stack: IResourceStack): Result<IResourceStack[]> {
    const working = this.ensureWorking()
    if (!working.ok) {
      return working
    }
    if (stack.amount > this.amountOf(stack.resource)) {
      return fail(ResultCode.EMPTY, `Not enough ${stack.resource} in the storage`)
    }
    return ok(withAmount(this.items, stack.resource, this.amountOf(stack.resource) - stack.amount))
  }
}

function withAmount(items: IResourceStack[], resource: IResourceStack['resource'], amount: number): IResourceStack[] {
  const others = items.filter((stack) => stack.resource !== resource)
  return amount > 0 ? [...others, { resource, amount }] : others
}

export type FactoryJobKind = 'craft' | 'research'

// A piece of production the factory works on, done at `readyAt` (ms of the game clock)
export interface FactoryJob {
  kind: FactoryJobKind
  // The module crafted, or the module whose blueprint is researched
  module: string
  readyAt: number
}

const JOB_KINDS: readonly string[] = ['craft', 'research']

// The factory works through a queue of jobs one after another (design §9.3)
export class FactoryModule extends GameModule {
  // How many jobs may wait in the queue
  get queueSize(): number {
    return this.number('queueSize', 10)
  }

  get jobs(): FactoryJob[] {
    const raw = this.record.props.jobs
    if (!Array.isArray(raw)) {
      return []
    }
    return raw.filter(
      (job): job is FactoryJob =>
        JOB_KINDS.includes(job?.kind) && typeof job.module === 'string' && Number.isFinite(job.readyAt)
    )
  }

  // When the last job in the queue is done
  get busyUntil(): number {
    return this.jobs.reduce((latest, job) => Math.max(latest, job.readyAt), 0)
  }

  // Puts a job at the end of the queue: it starts when the one before it ends
  enqueue(
    job: { kind: FactoryJobKind; module: string; durationMs: number },
    now: number
  ): Result<{ job: FactoryJob; patch: Record<string, unknown> }> {
    const working = this.ensureWorking()
    if (!working.ok) {
      return working
    }
    if (this.jobs.length >= this.queueSize) {
      return fail(ResultCode.BUSY, 'The factory queue is full')
    }
    const queued: FactoryJob = {
      kind: job.kind,
      module: job.module,
      readyAt: Math.max(now, this.busyUntil) + job.durationMs
    }
    return ok({ job: queued, patch: { jobs: [...this.jobs, queued] } })
  }

  // The jobs that are done by `now` and what the queue holds afterwards. A broken factory finishes nothing.
  settle(now: number): { done: FactoryJob[]; patch: Record<string, unknown> } {
    if (!this.isWorking) {
      return { done: [], patch: {} }
    }
    const done = this.jobs.filter((job) => job.readyAt <= now)
    return { done, patch: done.length ? { jobs: this.jobs.filter((job) => job.readyAt > now) } : {} }
  }
}

export class ArmorModule extends GameModule {
  // Damage taken off every hit (design §12.6)
  get protection(): number {
    return this.number('protection', 0)
  }

  get material(): string {
    return this.text('material', '')
  }
}

export class EngineModule extends GameModule {
  get engineType(): EngineType {
    const type = this.text('engineType', EngineType.ELECTRIC)
    return Object.values(EngineType).includes(type as EngineType) ? (type as EngineType) : EngineType.ELECTRIC
  }

  // Weight the engine can move per tick (design §8.5)
  get speed(): number {
    return this.number('speed', 0)
  }
}

// Wheels or tracks
export class MovementModule extends GameModule {
  // kg the chassis can carry (design §8.5)
  get loadCapacity(): number {
    return this.number('loadCapacity', 0)
  }
}

export class MiningModule extends GameModule {
  get materialPerOperation(): number {
    return this.number('materialPerOperation', 0)
  }

  // The hardest resource the drill can break (design §9.1)
  get strength(): number {
    return this.number('strength', 0)
  }

  // What one operation takes out of a deposit
  extract(deposit: IResourceStack, hardness: number): Result<IResourceStack> {
    const working = this.ensureWorking()
    if (!working.ok) {
      return working
    }
    if (hardness > this.strength) {
      return fail(ResultCode.TOO_LOW, `The drill is too weak for ${deposit.resource}`)
    }
    if (deposit.amount <= 0) {
      return fail(ResultCode.EMPTY, 'The deposit is empty')
    }
    return ok({ resource: deposit.resource, amount: Math.min(this.materialPerOperation, deposit.amount) })
  }
}

export class ManipulatorModule extends GameModule {
  get loadCapacity(): number {
    return this.number('loadCapacity', 0)
  }
}

export class GpsModule extends GameModule {}
