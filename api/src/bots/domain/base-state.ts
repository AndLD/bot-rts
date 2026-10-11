import { GameModule, WirelessAdapterModule } from '../../modules/domain/game-module'

// A base is a corpse for its owner when the owner has lost control of it: there is no working wireless adapter left, or
// no module at all (design §6.3). It is derived from the modules, never stored, so repairing the adapter brings it back.
export function isCorpse(modules: readonly GameModule[]): boolean {
  return !modules.some((module) => module instanceof WirelessAdapterModule && module.isWorking)
}
