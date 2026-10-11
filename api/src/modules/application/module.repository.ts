import { Module } from '../domain/module.entity'

export const MODULE_REPOSITORY = Symbol('ModuleRepository')

export interface ModuleRepository {
  addMany(modules: Module[]): Promise<void>
  // Writes the changed state of modules that exist (their properties and condition)
  update(module: Module): Promise<void>
  // Deletes a module for good (it was taken apart)
  remove(id: string): Promise<void>
  listOfBot(botId: string): Promise<Module[]>
}
