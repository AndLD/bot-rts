import { ModuleType } from '../../../../lib/utils/interfaces/modules'
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

  // A numeric property, or the fallback when it is missing or not a usable number
  protected number(key: string, fallback: number): number {
    const value = Number(this.record.props[key])
    return this.record.props[key] !== undefined && Number.isFinite(value) && value >= 0 ? value : fallback
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

  // The stored energy
  get value(): number {
    return this.number('value', 0)
  }
}

export class GeneratorModule extends GameModule {}

export class StorageModule extends GameModule {
  get capacity(): number {
    return this.number('capacity', 0)
  }
}

export class FactoryModule extends GameModule {}

export class ArmorModule extends GameModule {}

// Types whose behaviour has no class of its own yet (engine, mining, manipulator, gps)
export class PlainModule extends GameModule {}
