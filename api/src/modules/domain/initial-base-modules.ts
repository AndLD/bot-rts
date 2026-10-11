import { Module } from './module.entity'

export type ModuleTemplate = Omit<Module, 'id' | 'botId'>

const full = { condition: 100, maxCondition: 100 }

// The equipment every new base starts with
export const INITIAL_BASE_MODULES: readonly ModuleTemplate[] = [
  {
    type: 'weapon',
    name: 'gun-class1',
    ...full,
    idleCost: 0.05,
    operationCost: 5,
    weight: 30,
    props: { distance: 5, damage: 50, accuracy: 0.5, cooldown: 2000, caliber: 25 }
  },
  {
    type: 'scanner',
    name: 'scanner-class1',
    ...full,
    idleCost: 0.05,
    operationCost: 1,
    weight: 30,
    props: { distance: 1, delay: 250 }
  },
  { type: 'factory', name: 'factory-class1', ...full, idleCost: 0.05, operationCost: 40, weight: 30, props: {} },
  {
    type: 'armor',
    name: 'armor-class1',
    ...full,
    idleCost: 0,
    operationCost: 0,
    weight: 45,
    props: { material: 'iron' }
  },
  {
    type: 'battery',
    name: 'battery-class1',
    ...full,
    idleCost: 0,
    operationCost: 0,
    weight: 50,
    props: { isConnected: true, voltage: 12, capacity: 3000, value: 3000 }
  },
  {
    type: 'generator',
    name: 'generator-class1',
    ...full,
    idleCost: 0,
    operationCost: 1,
    weight: 50,
    props: { delay: 250, isEnabled: false, energyPerOperation: 300 }
  },
  {
    type: 'storage',
    name: 'storage-class1',
    ...full,
    idleCost: 0,
    operationCost: 1,
    weight: 50,
    props: { capacity: 200, items: [] }
  }
]
