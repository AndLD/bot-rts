import { Error, ID, Item, Material } from '../types'
import { IFile } from './files'
import { IMapPoint } from './map'

export type ModuleType =
    | 'engine'
    | 'movement'
    | 'weapon'
    | 'mining'
    | 'manipulator'
    | 'circute'
    | 'drive'
    | 'processor'
    // | 'cooler'
    | 'wirelessAdapter'
    | 'battery'
    | 'storage'
    | 'armor'
    | 'scanner'
    | 'generator'
    // | 'wire'
    // | 'pipe'
    | 'factory'
    | 'gps'

export interface IModuleProps {
    _id?: ID
    botId?: ID
    type?: ModuleType
    name: string
    condition: number // HP
    maxCondition: number
    weight: number // kg
    operationCost: number // amount of energy/fuel per operation
    idleCost: number // amount of energy/fuel while idle
    // upgrades: IModuleUpgrade[]
}

export interface IModule extends IModuleProps {
    _id: ID
    type: ModuleType

    onError?(error: Error): void
}

export interface IEngineModuleProps extends IModuleProps {
    engineType: 'fuel' | 'steam' | 'electric'
    speed: number
    // power: number

    move(x: number, y: number, z?: number): Promise<Error | null>
    move(
        x: number,
        y: number,
        z?: number,
        callback?: (error: Error | null) => void
    ): Promise<Error | null>
}

export interface IEngineModule extends IEngineModuleProps {
    move(x: number, y: number, z?: number): Promise<Error | null>
    move(
        x: number,
        y: number,
        z?: number,
        callback?: (error: Error | null) => void
    ): Promise<Error | null>
}

export interface IMovementModuleProps extends IModuleProps {
    loadCapacity: number
}
export interface IMovementModule extends IMovementModuleProps {}

export interface IWeaponModuleProps extends IModuleProps {
    damage: number
    cooldown: number // in ms
    caliber: number
    // minDistance?: number
    distance: number
    accuracy: number
    batchSize?: number
    batchCooldown?: number // in ms
    isArtillery?: boolean // if true, shoot along a hinged trajectory instead of straight
    // splash?: number
}
export interface IWeaponModule extends IWeaponModuleProps {
    shoot(x: number, y: number, z?: number): Promise<Error | null>
    shoot(x: number, y: number, z?: number, callback?: (error: Error | null) => void): void
    reload(): Promise<Error | null>
    reload(callback?: (error: Error) => void): void
}

export interface IMiningModuleProps extends IModuleProps {
    materialPerOperation: number
}
export interface IMiningModule extends IMiningModuleProps {
    mine(x: number, y: number, z?: number): Promise<Error | null>
    mine(x: number, y: number, z?: number, callback?: (error: Error | null) => void): void
}

export interface IManipulatorModuleProps extends IModuleProps {
    loadCapacity: number
}
export interface IManipulatorModule extends IManipulatorModuleProps {
    take(x: number, y: number, z?: number): Promise<Error | null | Item>
    take(
        x: number,
        y: number,
        z?: number,
        callback?: (error: Error | null, item: Item | null) => void
    ): void

    take(itemId: ID, x: number, y: number, z?: number): Promise<Error | null | Item>
    take(
        itemId: ID,
        x: number,
        y: number,
        z?: number,
        callback?: (error: Error | null, item: Item | null) => void
    ): void

    take(itemId: ID): Promise<Error | null | Item>
    take(itemId: ID, callback?: (error: Error | null, item: Item | null) => void): void

    drop(x: number, y: number, z?: number): Promise<Error | null | Item>
    drop(
        x: number,
        y: number,
        z?: number,
        callback?: (error: Error | null, item: Item) => void
    ): void
}

export interface ICircuteModuleProps extends IModuleProps {
    delay: number // between operations in ms
}
export interface ICircuteModule extends ICircuteModuleProps {}

export interface IDriveModuleProps extends IModuleProps {
    readDelay: number // in ms
    writeDelay: number // in ms
}
export interface IDriveModule extends IDriveModuleProps {
    read(filename: string): Promise<Error | null | IFile>
    read(filename: string, callback?: (error: Error | null, file: IFile | null) => void): void
    write(filename: string): Promise<Error | null>
    write(filename: string, callback?: (error: Error | null) => void): void
}

export interface IProcessorModuleProps extends IModuleProps {
    delay: number // in ms
    // temperature: number // degrees in C
}
export interface IProcessorModule extends IProcessorModuleProps {
    runCode(filename: string): Promise<Error | null>
    runCode(filename: string, callback?: (error: Error | null) => void): void
}

export interface IWirelessAdapterModuleProps extends IModuleProps {
    _id: ID
    isConnected: boolean
    // maxConnections: number
}
export interface IWirelessAdapterModule extends IWirelessAdapterModuleProps {
    connect(deviceId: ID): Promise<Error | null | ID>
    connect(deviceId: ID, callback?: (error: Error | null, deviceId: ID) => void): void
    disconnect(deviceId: ID): Promise<Error | null | ID>
    disconnect(deviceId: ID, callback?: (error: Error | null, deviceId: ID) => void): void
}

export interface IBatteryModuleProps extends IModuleProps {
    capacity: number // energy points
    voltage: number // V, e.g. 12V, 24V
    value: number // energy points
    isConnected: boolean
}
export interface IBatteryModule extends IBatteryModuleProps {
    enable(): Promise<Error | null>
    enable(callback?: (error: Error | null) => void): void
    disable(): Promise<Error | null>
    disable(callback?: (error: Error | null) => void): void
}

export interface IStorageModuleProps extends IModuleProps {
    // storageType: 'fluid' | 'block'
    capacity: number
    items: Item[]
}
export interface IStorageModule extends IStorageModuleProps {
    store(item: Item): Promise<Error | null | Item>
    store(item: Item, callback?: (error: Error | null, item: Item) => void): void
}

export interface IArmorModuleProps extends IModuleProps {
    material: Material
}
export interface IArmorModule extends IArmorModuleProps {}

export interface IScannerModuleProps extends IModuleProps {
    distance: number
    delay: number // in ms
}
export interface IScannerModule extends IScannerModuleProps {
    scan(): Promise<Error | null | IMapPoint[]>
    scan(callback?: (error: Error | null, result: IMapPoint[]) => void): void
}

export interface IGeneratorModuleProps extends IModuleProps {
    energyPerOperation: number
    delay: number // in ms
    isEnabled: boolean
}
export interface IGeneratorModule extends IGeneratorModuleProps {
    enable(): Promise<Error | null>
    enable(callback?: (error: Error | null) => void): void
    disable(): Promise<Error | null>
    disable(callback?: (error: Error | null) => void): void
}

export interface IFactoryModuleProps extends IModuleProps {}
export interface IFactoryModule extends IFactoryModuleProps {}

export interface IGpsModuleProps extends IModuleProps {}
export interface IGpsModule extends IGpsModuleProps {
    getLocation(): Promise<Error | null | IMapPoint>
    getLocation(callback?: (error: Error | null, location: IMapPoint) => void): void
}

export type Module =
    | IEngineModule
    | IMovementModule
    | IWeaponModule
    | IMiningModule
    | IManipulatorModule
    | ICircuteModule
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
    | ICircuteModuleProps
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
