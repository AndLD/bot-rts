import { ObjectId } from 'mongodb'
import { IModule, IModuleProps, ModuleType } from '../../utils/interfaces/modules'
import { ID } from '../../utils/types'
import { EventEmitter } from 'events'
import { ErrorHandler } from '../../middlewares/ErrorHandler'

export default class Module extends EventEmitter implements IModule {
    _id!: ID
    type!: ModuleType
    name!: string
    weight!: number
    condition!: number
    maxCondition!: number
    idleCost!: number
    operationCost!: number

    constructor(props: IModuleProps) {
        super()

        if (!props.type) {
            throw new ErrorHandler(500, 'Module type is not specified')
        }

        Object.assign(this, props)

        if (!props._id) {
            this._id = new ObjectId()
        }
    }
}
