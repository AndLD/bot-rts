import { Module } from './module.entity'

export type ModuleTemplate = Omit<Module, 'id' | 'botId'>

const full = { condition: 100, maxCondition: 100 }

// The modules that exist, by name, with the numbers of a new one. Data, not logic: tuning a module is a change here
// (and, later, in the recipes config of design §9.3).
export const MODULE_CATALOG: readonly ModuleTemplate[] = [
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
  },
  {
    type: 'processor',
    name: 'processor-class1',
    ...full,
    idleCost: 0.05,
    operationCost: 1,
    weight: 10,
    props: { delay: 250, opsPerTick: 2, parallelExecutions: 1 }
  },
  {
    type: 'drive',
    name: 'memory-class1',
    ...full,
    idleCost: 0.01,
    operationCost: 0.1,
    weight: 5,
    props: { quota: 64 * 1024, readDelay: 50, writeDelay: 100 }
  },
  {
    type: 'wirelessAdapter',
    name: 'wireless-adapter-class1',
    ...full,
    idleCost: 0.05,
    operationCost: 0.1,
    weight: 5,
    props: { range: 20, isConnected: true }
  }
]

// What every new base starts with (design §6.1)
export const STARTER_KIT: readonly string[] = [
  'gun-class1',
  'scanner-class1',
  'factory-class1',
  'armor-class1',
  'battery-class1',
  'generator-class1',
  'storage-class1',
  'processor-class1',
  'memory-class1',
  'wireless-adapter-class1'
]
