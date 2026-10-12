import type { AssemblyService } from '../../bots/application/assembly.service'
import type { BotsService } from '../../bots/application/bots.service'
import type { FactoryService } from '../../bots/application/factory.service'
import type { MaintenanceService } from '../../bots/application/maintenance.service'
import type { ScanService } from '../../bots/application/scan.service'
import type { FilesService } from '../../files/application/files.service'

// The use cases that change the world. The API thread never runs them itself: it sends them to the engine, which is the single
// writer (design §14.2), and the engine runs them between its ticks. Each name is `<service>.<method>`.
export interface WorldActions {
  'bots.deployUserBase': BotsService['deployUserBase']
  'scan.scan': ScanService['scan']
  'factory.craft': FactoryService['craft']
  'factory.research': FactoryService['research']
  'factory.learn': FactoryService['learn']
  'assembly.assemble': AssemblyService['assemble']
  'maintenance.repair': MaintenanceService['repair']
  'maintenance.disassemble': MaintenanceService['disassemble']
  'files.write': FilesService['write']
  'files.makeDirectory': FilesService['makeDirectory']
  'files.remove': FilesService['remove']
}

export type WorldActionName = keyof WorldActions

// Every action once; a new action that is missing here does not compile
export const WORLD_ACTION_NAMES: Record<WorldActionName, true> = {
  'bots.deployUserBase': true,
  'scan.scan': true,
  'factory.craft': true,
  'factory.research': true,
  'factory.learn': true,
  'assembly.assemble': true,
  'maintenance.repair': true,
  'maintenance.disassemble': true,
  'files.write': true,
  'files.makeDirectory': true,
  'files.remove': true
}

export const isWorldAction = (name: unknown): name is WorldActionName =>
  typeof name === 'string' && Object.prototype.hasOwnProperty.call(WORLD_ACTION_NAMES, name)
