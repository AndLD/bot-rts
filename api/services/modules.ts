import { ErrorHandler } from '../middlewares/ErrorHandler'
import { IModule, IModuleProps, ModuleProps } from '../utils/interfaces/modules'
import { ID } from '../utils/types'
import { modulesCollection } from './db'

async function attachModulesToBot(botId: ID, modulesProps: IModuleProps[]): Promise<ModuleProps[]> {
  const modules = modulesProps.map((moduleProps) => ({ ...moduleProps, botId: botId.toString() }))
  const result = await modulesCollection.insertMany(modules)

  if (result.insertedCount !== modules.length) {
    throw new ErrorHandler(500, 'Modules were not stored')
  }

  return modules
}

export const modulesService = { attachModulesToBot }
