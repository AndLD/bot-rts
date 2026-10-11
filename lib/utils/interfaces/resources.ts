// The natural resources of the world (design §9.1)
export enum RESOURCE {
  IRON = 'iron',
  STONE = 'stone',
  WOOD = 'wood',
  OIL = 'oil',
  CRYSTAL = 'crystal',
  GOLD = 'gold'
}

export const RESOURCES: readonly RESOURCE[] = Object.values(RESOURCE)

// The balance numbers of one resource; the tunable values live in configuration, these are the defaults
export interface IResourceBalance {
  // Relative chance among resources that a freshly generated resource cell holds this one
  spawnWeight: number
  // A deposit holds a fixed amount in this range (inclusive), set at generation and never regenerated
  minAmount: number
  maxAmount: number
  // How hard the resource is to mine (a drill must be at least this strong)
  hardness: number
}

export type ResourceBalance = Record<RESOURCE, IResourceBalance>

export const DEFAULT_RESOURCE_BALANCE: ResourceBalance = {
  [RESOURCE.IRON]: { spawnWeight: 30, minAmount: 80, maxAmount: 200, hardness: 2 },
  [RESOURCE.STONE]: { spawnWeight: 25, minAmount: 100, maxAmount: 250, hardness: 1 },
  [RESOURCE.WOOD]: { spawnWeight: 20, minAmount: 60, maxAmount: 160, hardness: 1 },
  [RESOURCE.OIL]: { spawnWeight: 12, minAmount: 40, maxAmount: 120, hardness: 2 },
  [RESOURCE.CRYSTAL]: { spawnWeight: 9, minAmount: 20, maxAmount: 80, hardness: 3 },
  [RESOURCE.GOLD]: { spawnWeight: 4, minAmount: 10, maxAmount: 40, hardness: 3 }
}

// A quantity of one resource, e.g. a deposit or the contents of a storage module
export interface IResourceStack {
  resource: RESOURCE
  amount: number
}
