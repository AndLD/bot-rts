import {
  IWeaponModuleProps,
  IArmorModuleProps,
  IBatteryModuleProps,
  IFactoryModuleProps,
  IGeneratorModuleProps,
  IScannerModuleProps,
  IStorageModuleProps
} from '../../utils/interfaces/modules'
import { Item } from '../../utils/types'

const gunClass1: IWeaponModuleProps = {
  name: 'gun-class1',
  condition: 100,
  maxCondition: 100,
  idleCost: 0.05,
  operationCost: 5,
  weight: 30,
  distance: 5,
  damage: 50,
  accuracy: 0.5,
  cooldown: 2000,
  caliber: 25
}

const scannerClass1: IScannerModuleProps = {
  type: 'scanner',
  name: 'scanner-class1',
  condition: 100,
  maxCondition: 100,
  idleCost: 0.05,
  operationCost: 1,
  weight: 30,
  distance: 5,
  delay: 250
}

const factoryClass1: IFactoryModuleProps = {
  type: 'factory',
  name: 'factory-class1',
  condition: 100,
  maxCondition: 100,
  idleCost: 0.05,
  operationCost: 40,
  weight: 30
}

const armorClass1: IArmorModuleProps = {
  type: 'armor',
  name: 'armor-class1',
  condition: 100,
  maxCondition: 100,
  idleCost: 0,
  operationCost: 0,
  weight: 45,
  material: 'iron'
}

const batteryClass1: IBatteryModuleProps = {
  type: 'battery',
  name: 'battery-class1',
  condition: 100,
  maxCondition: 100,
  idleCost: 0,
  operationCost: 0,
  weight: 50,
  isConnected: true,
  voltage: 12,
  capacity: 3000,
  value: 3000
}

const generatorClass1: IGeneratorModuleProps = {
  type: 'generator',
  name: 'generator-class1',
  condition: 100,
  maxCondition: 100,
  idleCost: 0,
  operationCost: 1,
  weight: 50,
  delay: 250,
  isEnabled: false,
  energyPerOperation: 300
}

const storageClass1: IStorageModuleProps = {
  type: 'storage',
  name: 'storage-class1',
  condition: 100,
  maxCondition: 100,
  idleCost: 0,
  operationCost: 1,
  weight: 50,
  capacity: 200,
  items: [] as Item[]
}

export const initialUserBaseModules = [
  gunClass1,
  scannerClass1,
  factoryClass1,
  armorClass1,
  batteryClass1,
  generatorClass1,
  storageClass1
  // processor
  // memory
  // circute
  // wirelessAdaptor
]
