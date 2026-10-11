import { Module } from '../domain/module.entity'

export const MODULE_REPOSITORY = Symbol('ModuleRepository')

export interface ModuleRepository {
  addMany(modules: Module[]): Promise<void>
  listOfBot(botId: string): Promise<Module[]>
}
