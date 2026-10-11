import { Module } from '../../src/modules/domain/module.entity'
import { InMemoryModuleRepository } from './fakes'

// The memory module of the starter kit, changed for a test (a small quota, a broken drive, …)
export function customiseDrive(modules: InMemoryModuleRepository, botId: string, overrides: Partial<Module>): Module {
  const index = modules.items.findIndex((module) => module.botId === botId && module.type === 'drive')
  modules.items[index] = { ...modules.items[index], ...overrides }
  return modules.items[index]
}

export function removeDrives(modules: InMemoryModuleRepository, botId: string) {
  modules.items.splice(0, modules.items.length, ...modules.items.filter((m) => m.botId !== botId || m.type !== 'drive'))
}
