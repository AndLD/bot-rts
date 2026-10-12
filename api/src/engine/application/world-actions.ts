import { ManualCategory } from '../../../../lib/utils/interfaces/settings'
import type { AssemblyService } from '../../bots/application/assembly.service'
import type { BotsService } from '../../bots/application/bots.service'
import type { FactoryService } from '../../bots/application/factory.service'
import type { MaintenanceService } from '../../bots/application/maintenance.service'
import type { ScanService } from '../../bots/application/scan.service'
import type { BotAccessService } from '../../terminal/application/bot-access.service'
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
  'access.connect': BotAccessService['connect']
  'access.adopt': BotAccessService['adopt']
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
  'files.remove': true,
  'access.connect': true,
  'access.adopt': true
}

export const isWorldAction = (name: unknown): name is WorldActionName =>
  typeof name === 'string' && Object.prototype.hasOwnProperty.call(WORLD_ACTION_NAMES, name)

// The category of manual control each action belongs to (design §15.1), or none for what is not micromanagement
export const ACTION_CATEGORIES: Record<WorldActionName, ManualCategory | null> = {
  'bots.deployUserBase': null,
  'scan.scan': null,
  'factory.craft': ManualCategory.FABRICATION,
  'factory.research': ManualCategory.FABRICATION,
  'factory.learn': ManualCategory.FABRICATION,
  'assembly.assemble': ManualCategory.FABRICATION,
  'maintenance.repair': ManualCategory.MAINTENANCE,
  'maintenance.disassemble': ManualCategory.MAINTENANCE,
  'files.write': null,
  'files.makeDirectory': null,
  'files.remove': null,
  'access.connect': ManualCategory.COMMUNICATION,
  'access.adopt': ManualCategory.COMMUNICATION
}

// Which bot a manual action takes control of, from its arguments (design §11.2.1: control needs the radio link)
const CONTROLLED_BOT: Record<WorldActionName, (args: readonly unknown[]) => unknown> = {
  'bots.deployUserBase': () => null,
  'scan.scan': (args) => args[1],
  'factory.craft': (args) => args[1],
  'factory.research': (args) => args[1],
  'factory.learn': (args) => args[1],
  'assembly.assemble': (args) => (args[1] as { baseId: string }).baseId,
  'maintenance.repair': (args) => (args[1] as { repairerId: string }).repairerId,
  'maintenance.disassemble': (args) => (args[1] as { repairerId: string }).repairerId,
  'files.write': (args) => args[1],
  'files.makeDirectory': (args) => args[1],
  'files.remove': (args) => args[1],
  'access.connect': (args) => args[1],
  'access.adopt': (args) => args[1]
}

// The player and the bot a manual action takes control of, or null when it controls none
export function controlledBotOf(
  name: WorldActionName,
  args: readonly unknown[]
): { userId: string; botId: string } | null {
  const botId = CONTROLLED_BOT[name](args)
  return typeof botId === 'string' ? { userId: args[0] as string, botId } : null
}
