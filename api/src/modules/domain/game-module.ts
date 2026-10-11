import { EngineType, ModuleType } from '../../../../lib/utils/interfaces/modules'
import { IResourceStack, RESOURCES } from '../../../../lib/utils/interfaces/resources'
import { fail, ok, Result, ResultCode } from '../../../../lib/utils/result'
import { Module } from './module.entity'

// The size of a class-1 memory module (design §11.4)
export const DEFAULT_DRIVE_QUOTA_BYTES = 64 * 1024

// A module as the game rules see it: the stored record plus the typed meaning of its type-specific properties. Each
// type is a subclass, so new behaviour of a type goes into its class and nowhere else (AGENTS.md §4).
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

export class ScannerModule extends GameModule {
  // Radius in cells
  get distance(): number {
    return this.number('distance', 0)
  }

  // Cooldown in ms
  get delay(): number {
    return this.number('delay', 0)
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

export class WeaponModule extends GameModule {
  get damage(): number {
    return this.number('damage', 0)
  }

  get distance(): number {
    return this.number('distance', 0)
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

export class GeneratorModule extends GameModule {
  get delay(): number {
    return this.number('delay', 0)
  }

  get energyPerOperation(): number {
    return this.number('energyPerOperation', 0)
  }

  get isEnabled(): boolean {
    return this.flag('isEnabled', false)
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

export class FactoryModule extends GameModule {}

export class ArmorModule extends GameModule {
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
