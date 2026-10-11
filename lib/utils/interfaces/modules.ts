import { ID } from '../types'
import { Result } from '../result'
import { IFile } from './files'
import { IMapPoint, Location } from './map'
import { IResourceStack } from './resources'

export type ModuleType =
  | 'engine'
  | 'movement'
  | 'weapon'
  | 'mining'
  | 'manipulator'
  | 'drive'
  | 'processor'
  | 'wirelessAdapter'
  | 'battery'
  | 'storage'
  | 'armor'
  | 'scanner'
  | 'generator'
  | 'factory'
  | 'gps'

// Every module type, for code that must cover them all
export const MODULE_TYPES: readonly ModuleType[] = [
  'engine',
  'movement',
  'weapon',
  'mining',
  'manipulator',
  'drive',
  'processor',
  'wirelessAdapter',
  'battery',
  'storage',
  'armor',
  'scanner',
  'generator',
  'factory',
  'gps'
]

export enum EngineType {
  FUEL = 'fuel',
  STEAM = 'steam',
  ELECTRIC = 'electric'
}

// What every module has (design §7.1)
export interface IModuleProps {
  _id?: ID
  botId?: ID
  type: ModuleType
  name: string
  condition: number // HP
  maxCondition: number
  weight: number // kg
  operationCost: number // amount of energy/fuel per operation
  idleCost: number // amount of energy/fuel while idle
}

export interface IModule extends IModuleProps {
  _id: ID
}

// The props of each type and the script functions it grants. Every function returns Promise<Result<T>>: expected
// failures are values, not exceptions (design §10.3).

export interface IEngineModuleProps extends IModuleProps {
  engineType: EngineType
  speed: number
}
export interface IEngineModule extends IEngineModuleProps {
  move(cells: number): Promise<Result>
  turn(direction: 'left' | 'right'): Promise<Result>
}

// Wheels or tracks: what the bot rolls on, and how much it can carry
export interface IMovementModuleProps extends IModuleProps {
  loadCapacity: number
}
export interface IMovementModule extends IMovementModuleProps {}

export interface IWeaponModuleProps extends IModuleProps {
  damage: number
  cooldown: number // in ms
  caliber: number
  distance: number
  accuracy: number
  batchSize?: number
  batchCooldown?: number // in ms
  isArtillery?: boolean // if true, shoot along a hinged trajectory instead of straight
}
export interface IWeaponModule extends IWeaponModuleProps {
  aim(x: number, y: number): Promise<Result>
  shoot(x: number, y: number): Promise<Result>
  reload(): Promise<Result>
}

export interface IMiningModuleProps extends IModuleProps {
  materialPerOperation: number
  // The hardest resource the drill can break (design §9.1)
  strength: number
}
export interface IMiningModule extends IMiningModuleProps {
  mine(x: number, y: number): Promise<Result<IResourceStack>>
}

export interface IManipulatorModuleProps extends IModuleProps {
  loadCapacity: number
}
export interface IManipulatorModule extends IManipulatorModuleProps {
  take(itemId?: ID): Promise<Result<ID>>
  drop(x?: number, y?: number): Promise<Result>
}

export interface IDriveModuleProps extends IModuleProps {
  quota: number // in bytes
  readDelay: number // in ms
  writeDelay: number // in ms
}
export interface IDriveModule extends IDriveModuleProps {
  read(path: string): Promise<Result<IFile>>
  write(path: string, content: string): Promise<Result<IFile>>
}

export interface IProcessorModuleProps extends IModuleProps {
  delay: number // in ms
  opsPerTick: number
  parallelExecutions: number
}
export interface IProcessorModule extends IProcessorModuleProps {
  execute(path: string): Promise<Result<{ executionId: ID }>>
}

export interface IWirelessAdapterModuleProps extends IModuleProps {
  isConnected: boolean
  range: number // in cells
}
export interface IWirelessAdapterModule extends IWirelessAdapterModuleProps {
  connect(botId: ID): Promise<Result>
  disconnect(botId: ID): Promise<Result>
}

export interface IBatteryModuleProps extends IModuleProps {
  capacity: number // energy points
  voltage: number // V, e.g. 12V, 24V
  value: number // energy points
  isConnected: boolean
}
export interface IBatteryModule extends IBatteryModuleProps {
  enable(): Promise<Result>
  disable(): Promise<Result>
}

export interface IStorageModuleProps extends IModuleProps {
  capacity: number
  items: IResourceStack[]
}
export interface IStorageModule extends IStorageModuleProps {
  store(stack: IResourceStack): Promise<Result>
}

export interface IArmorModuleProps extends IModuleProps {
  material: string
}
export interface IArmorModule extends IArmorModuleProps {}

export interface IScannerModuleProps extends IModuleProps {
  distance: number
  delay: number // in ms
}
export interface IScannerModule extends IScannerModuleProps {
  scan(): Promise<Result<IMapPoint[]>>
}

export interface IGeneratorModuleProps extends IModuleProps {
  energyPerCycle: number
  fuelPerCycle: number // oil burnt from the bot's storage per cycle
  delay: number // in ms
  isEnabled: boolean
}
export interface IGeneratorModule extends IGeneratorModuleProps {
  enable(): Promise<Result>
  disable(): Promise<Result>
}

export interface IFactoryModuleProps extends IModuleProps {}
export interface IFactoryModule extends IFactoryModuleProps {}

export interface IGpsModuleProps extends IModuleProps {}
export interface IGpsModule extends IGpsModuleProps {
  getLocation(): Promise<Result<Location>>
}

export type Module =
  | IEngineModule
  | IMovementModule
  | IWeaponModule
  | IMiningModule
  | IManipulatorModule
  | IDriveModule
  | IProcessorModule
  | IWirelessAdapterModule
  | IBatteryModule
  | IStorageModule
  | IArmorModule
  | IScannerModule
  | IGeneratorModule
  | IFactoryModule
  | IGpsModule

export type ModuleProps =
  | IEngineModuleProps
  | IMovementModuleProps
  | IWeaponModuleProps
  | IMiningModuleProps
  | IManipulatorModuleProps
  | IDriveModuleProps
  | IProcessorModuleProps
  | IWirelessAdapterModuleProps
  | IBatteryModuleProps
  | IStorageModuleProps
  | IArmorModuleProps
  | IScannerModuleProps
  | IGeneratorModuleProps
  | IFactoryModuleProps
  | IGpsModuleProps
