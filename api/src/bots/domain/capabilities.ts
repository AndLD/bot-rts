import { GameModule, ProcessorModule, WirelessAdapterModule } from '../../modules/domain/game-module'

// What a bot can do with the modules it has, by the rules of broken modules (design §8.4.1): a module at condition 0
// stays attached but does nothing. Movement, shooting and the like are the rules of their own modules.

// Scripts can be launched and run only with a working processor
export function canRunScripts(modules: readonly GameModule[]): boolean {
  return modules.some((module) => module instanceof ProcessorModule && module.isWorking)
}

// A bot accepts and makes connections only with a working wireless adapter
export function canConnect(modules: readonly GameModule[]): boolean {
  return modules.some((module) => module instanceof WirelessAdapterModule && module.isWorking)
}
