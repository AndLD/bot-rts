import { Error, ID, Item, ItemType, Material } from '../types'
import { IFile } from './files'
import { IMapPoint } from './map'

export interface IBot {
    _id: ID
    label?: string
    modules: Module[]
}

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

interface _IModule {
    _id: ID
    type: ModuleType
    name: string
    condition: number // %
    weight: number // kg
    operationCost: number // amount of energy/fuel per operation
    idleCost: number // amount of energy/fuel while idle
    // upgrades: IModuleUpgrade[]

    onError?(error: Error): void
}

export interface IEngineModule extends _IModule {
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

export interface IMovementModule extends _IModule {
    loadCapacity: number
}

export interface IWeaponModule extends _IModule {
    damage: number
    cooldown: number // in ms
    caliber: number
    distance: number
    accuracy: number
    batchSize: number
    batchCooldown: number // in ms

    shoot(x: number, y: number, z?: number): Promise<Error | null>
    shoot(x: number, y: number, z?: number, callback?: (error: Error | null) => void): void
    reload(): Promise<Error | null>
    reload(callback?: (error: Error) => void): void
}

export interface IMiningModule extends _IModule {
    materialPerOperation: number

    mine(x: number, y: number, z?: number): Promise<Error | null>
    mine(x: number, y: number, z?: number, callback?: (error: Error | null) => void): void
}

export interface IManipulatorModule extends _IModule {
    loadCapacity: number

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

export interface ICircuteModule extends _IModule {
    delay: number // between operations in ms
}

export interface IDriveModule extends _IModule {
    readDelay: number // in ms
    writeDelay: number // in ms

    read(filename: string): Promise<Error | null | IFile>
    read(filename: string, callback?: (error: Error | null, file: IFile | null) => void): void
    write(filename: string): Promise<Error | null>
    write(filename: string, callback?: (error: Error | null) => void): void
}

export interface IProcessorModule extends _IModule {
    delay: number // in ms
    // temperature: number // degrees in C

    runCode(filename: string): Promise<Error | null>
    runCode(filename: string, callback?: (error: Error | null) => void): void
}

export interface IWirelessAdapterModule extends _IModule {
    _id: ID
    isConnected: boolean
    // maxConnections: number

    connect(deviceId: ID): Promise<Error | null | ID>
    connect(deviceId: ID, callback?: (error: Error | null, deviceId: ID) => void): void
    disconnect(deviceId: ID): Promise<Error | null | ID>
    disconnect(deviceId: ID, callback?: (error: Error | null, deviceId: ID) => void): void
}

export interface IBatteryModule extends _IModule {
    capacity: number // energy points
    voltage: number // V, e.g. 12V, 24V
    value: number // energy points
    isConnected: boolean

    enable(): Promise<Error | null>
    enable(callback?: (error: Error | null) => void): void
    disable(): Promise<Error | null>
    disable(callback?: (error: Error | null) => void): void
}

export interface IStorageModule extends _IModule {
    // storageType: 'fluid' | 'block'
    capacity: number
    items: Item[]

    store(item: Item): Promise<Error | null | Item>
    store(item: Item, callback?: (error: Error | null, item: Item) => void): void
}

export interface IArmorModule extends _IModule {
    material: Material
}

export interface IScannerModule extends _IModule {
    distance: number
    delay: number // in ms

    scan(): Promise<Error | null | IMapPoint[]>
    scan(callback?: (error: Error | null, result: IMapPoint[]) => void): void
}

export interface IGeneratorModule extends _IModule {
    energyPerOperation: number
    delay: number // in ms
    enabled: boolean

    enable(): Promise<Error | null>
    enable(callback?: (error: Error | null) => void): void
    disable(): Promise<Error | null>
    disable(callback?: (error: Error | null) => void): void
}

export interface IFactoryModule extends _IModule {}

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
