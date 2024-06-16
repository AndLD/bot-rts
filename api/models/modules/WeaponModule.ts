import { IWeaponModule, IWeaponModuleProps, ModuleType } from '../../utils/interfaces/modules'
import { Error } from '../../utils/types'
import Module from './Module'

export default class WeaponModule extends Module implements IWeaponModule {
    type: ModuleType = 'weapon'
    damage!: number
    cooldown!: number // in ms
    caliber!: number
    distance!: number
    accuracy!: number
    batchSize?: number
    batchCooldown?: number // in ms

    constructor(props: IWeaponModuleProps) {
        super(props)
        // Object.assign(this, props)
    }

    async shoot(x: number, y: number, z?: number): Promise<Error | null> {
        // Example implementation
        try {
            // Your shoot logic here
            return null // Or return a CustomError object if there's an error
        } catch (error) {
            return error as Error
        }
    }

    async reload(): Promise<Error | null> {
        // Example implementation
        try {
            // Your reload logic here
            return null // Or return a CustomError object if there's an error
        } catch (error) {
            return error as Error
        }
    }
}
