import { Module } from './module.entity'

export type ModuleTemplate = Omit<Module, 'id' | 'botId'>

const full = { condition: 100, maxCondition: 100 }

// The modules that exist, by name, with the numbers of a new one. Data, not logic: tuning a module is a change here
// (and, later, in the recipes config of design §9.3).
export const MODULE_CATALOG: readonly ModuleTemplate[] = [
  {
    type: 'engine',
    name: 'engine-class1',
    ...full,
    idleCost: 0,
    operationCost: 2,
    weight: 40,
    props: { engineType: 'electric', speed: 50 }
  },
  {
    type: 'movement',
    name: 'wheels-class1',
    ...full,
    idleCost: 0,
    operationCost: 0,
    weight: 25,
    props: { loadCapacity: 400 }
  },
  {
    type: 'mining',
    name: 'drill-class1',
    ...full,
    idleCost: 0,
    operationCost: 3,
    weight: 35,
    props: { materialPerOperation: 5, strength: 2 }
  },
  {
    type: 'manipulator',
    name: 'manipulator-class1',
    ...full,
    idleCost: 0,
    operationCost: 1,
    weight: 20,
    props: { loadCapacity: 50 }
  },
  {
    type: 'repair',
    name: 'repair-class1',
    ...full,
    idleCost: 0,
    operationCost: 5,
    weight: 25,
    props: { repairPerOp: 25, delay: 1000 }
  },
  { type: 'gps', name: 'gps-class1', ...full, idleCost: 0.01, operationCost: 0.1, weight: 2, props: {} },
  {
    type: 'weapon',
    name: 'gun-class1',
    ...full,
    idleCost: 0.05,
    operationCost: 5,
    weight: 30,
    props: { distance: 5, damage: 50, accuracy: 0.5, cooldown: 2000, caliber: 25, magazine: 10, loaded: 10 }
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
  {
    type: 'weapon',
    name: 'gun-class2',
    ...full,
    idleCost: 0.05,
    operationCost: 6,
    weight: 40,
    props: { distance: 8, damage: 80, accuracy: 0.7, cooldown: 1500, caliber: 25, magazine: 15, loaded: 15 }
  },
  {
    type: 'scanner',
    name: 'scanner-class2',
    ...full,
    idleCost: 0.08,
    operationCost: 1,
    weight: 35,
    props: { distance: 3, delay: 250 }
  },
  {
    type: 'mining',
    name: 'drill-class2',
    ...full,
    idleCost: 0,
    operationCost: 4,
    weight: 45,
    props: { materialPerOperation: 10, strength: 3 }
  },
  {
    type: 'battery',
    name: 'battery-class2',
    ...full,
    idleCost: 0,
    operationCost: 0,
    weight: 70,
    props: { isConnected: true, voltage: 24, capacity: 8000, value: 8000 }
  },
  {
    type: 'factory',
    name: 'factory-class1',
    ...full,
    idleCost: 0.05,
    operationCost: 40,
    weight: 30,
    props: { queueSize: 10, jobs: [] }
  },
  {
    type: 'armor',
    name: 'armor-class1',
    ...full,
    idleCost: 0,
    operationCost: 0,
    weight: 45,
    props: { material: 'iron', protection: 10 }
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
    props: { delay: 250, isEnabled: true, energyPerCycle: 12, fuelPerCycle: 0.02 }
  },
  {
    type: 'solarPanel',
    name: 'solar-panel-class1',
    ...full,
    idleCost: 0,
    operationCost: 1,
    weight: 30,
    // 8 energy per second at full sun, nothing burnt (design §7.2.1)
    props: { delay: 250, isEnabled: true, energyPerCycle: 2 }
  },
  {
    type: 'storage',
    name: 'storage-class1',
    ...full,
    idleCost: 0,
    operationCost: 1,
    weight: 50,
    props: { capacity: 200, items: [{ resource: 'oil', amount: 50 }] }
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
