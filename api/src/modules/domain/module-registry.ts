import { ModuleType } from '../../../../lib/utils/interfaces/modules'
import { UnknownModuleTypeError } from './module.errors'
import {
  ArmorModule,
  BatteryModule,
  DriveModule,
  EngineModule,
  FactoryModule,
  GameModule,
  GeneratorModule,
  GpsModule,
  ManipulatorModule,
  MiningModule,
  MovementModule,
  ProcessorModule,
  StorageModule,
  WirelessAdapterModule
} from './game-module'
import { Module } from './module.entity'
import { ScannerModule } from './scanner-module'
import { WeaponModule } from './weapon-module'

type ModuleClass = new (record: Module) => GameModule

// Turns stored module records into the classes of their types. A new module type is one `register` call.
export class ModuleRegistry {
  private readonly classes = new Map<ModuleType, ModuleClass>()

  register(type: ModuleType, moduleClass: ModuleClass): this {
    this.classes.set(type, moduleClass)
    return this
  }

  instantiate(record: Module): GameModule {
    const moduleClass = this.classes.get(record.type)
    if (!moduleClass) {
      throw new UnknownModuleTypeError(record.type)
    }
    return new moduleClass(record)
  }

  instantiateAll(records: readonly Module[]): GameModule[] {
    return records.map((record) => this.instantiate(record))
  }

  // The modules of one class among the records, e.g. the scanners of a bot
  instancesOf<T extends GameModule>(records: readonly Module[], moduleClass: new (record: Module) => T): T[] {
    return this.instantiateAll(records).filter((module): module is T => module instanceof moduleClass)
  }
}

export function createModuleRegistry(): ModuleRegistry {
  return new ModuleRegistry()
    .register('scanner', ScannerModule)
    .register('drive', DriveModule)
    .register('processor', ProcessorModule)
    .register('wirelessAdapter', WirelessAdapterModule)
    .register('weapon', WeaponModule)
    .register('battery', BatteryModule)
    .register('generator', GeneratorModule)
    .register('storage', StorageModule)
    .register('factory', FactoryModule)
    .register('armor', ArmorModule)
    .register('engine', EngineModule)
    .register('movement', MovementModule)
    .register('mining', MiningModule)
    .register('manipulator', ManipulatorModule)
    .register('gps', GpsModule)
}
