import { ModuleType } from '../../../../lib/utils/interfaces/modules'

export interface Module {
  readonly id: string
  readonly botId: string
  readonly type: ModuleType
  readonly name: string
  readonly condition: number
  readonly maxCondition: number
  readonly weight: number
  readonly operationCost: number
  readonly idleCost: number
  // Properties specific to the module type (damage, capacity, …)
  readonly props: Readonly<Record<string, unknown>>
}
