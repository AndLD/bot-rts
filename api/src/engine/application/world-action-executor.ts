import { AssemblyService } from '../../bots/application/assembly.service'
import { BotsService } from '../../bots/application/bots.service'
import { FactoryService } from '../../bots/application/factory.service'
import { MaintenanceService } from '../../bots/application/maintenance.service'
import { ScanService } from '../../bots/application/scan.service'
import { FilesService } from '../../files/application/files.service'
import { SupportService } from '../../support/application/support.service'
import { BotAccessService } from '../../terminal/application/bot-access.service'
import { ValidationError } from '../../shared/domain/errors'
import { isWorldAction, WorldActionName, WorldActions } from './world-actions'

export const WORLD_ACTION_EXECUTOR = Symbol('WorldActionExecutor')

// Runs a world action with the real use cases (the engine side of design §14.2)
export class WorldActionExecutor {
  private readonly table: { [K in WorldActionName]: WorldActions[K] }

  constructor(services: {
    bots: BotsService
    scans: ScanService
    factory: FactoryService
    assembly: AssemblyService
    maintenance: MaintenanceService
    files: FilesService
    access: BotAccessService
    support: SupportService
  }) {
    const { bots, scans, factory, assembly, maintenance, files, access, support } = services
    this.table = {
      'bots.deployUserBase': bots.deployUserBase.bind(bots),
      'scan.scan': scans.scan.bind(scans),
      'factory.craft': factory.craft.bind(factory),
      'factory.research': factory.research.bind(factory),
      'factory.learn': factory.learn.bind(factory),
      'assembly.assemble': assembly.assemble.bind(assembly),
      'maintenance.repair': maintenance.repair.bind(maintenance),
      'maintenance.disassemble': maintenance.disassemble.bind(maintenance),
      'files.write': files.write.bind(files),
      'files.makeDirectory': files.makeDirectory.bind(files),
      'files.remove': files.remove.bind(files),
      'access.connect': access.connect.bind(access),
      'access.adopt': access.adopt.bind(access),
      'support.grantResources': support.grantResources.bind(support),
      'support.removeResources': support.removeResources.bind(support),
      'support.restoreModule': support.restoreModule.bind(support)
    }
  }

  execute(name: string, args: readonly unknown[]): Promise<unknown> {
    if (!isWorldAction(name)) {
      throw new ValidationError(`Unknown action ${name}`)
    }
    return (this.table[name] as (...a: unknown[]) => Promise<unknown>)(...args)
  }
}
