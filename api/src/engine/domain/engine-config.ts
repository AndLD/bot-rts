import { DEFAULT_MOVEMENT_BALANCE, MovementBalance } from '../../bots/domain/movement'
import { CombatBalance, DEFAULT_COMBAT_BALANCE } from '../../modules/domain/weapon-module'

// The tunable numbers of the engine (design §12.2, §12.2.1, §12.3.1); the deployment may override them from the
// environment, nothing in the game logic hard-codes them (AGENTS.md §9)
export interface EngineConfig {
  // Length of a game tick in ms; module timings are converted to ticks with it
  tickIntervalMs: number
  // Wall-clock slice one execution may use per tick before it is killed
  sliceMs: number
  // Share of the tick interval the whole run phase may take; the rest of the work resumes next tick
  tickCapRatio: number
  // World state is written to the database every this many ticks (write-behind)
  flushEveryTicks: number
  // Limits of one script execution
  memoryBytes: number
  stackBytes: number
  // An execution found running after this many consecutive unclean restarts is killed instead of relaunched
  maxRestarts: number
  // An execution that has run this many ticks since its relaunch is healthy: its restart count is forgotten
  healthyTicks: number
  // Game rules whose numbers the engine applies (design §8.5, §12.6)
  movement: MovementBalance
  combat: CombatBalance
}

export const DEFAULT_ENGINE_CONFIG: EngineConfig = {
  tickIntervalMs: 100,
  sliceMs: 5,
  tickCapRatio: 0.8,
  flushEveryTicks: 10,
  memoryBytes: 4 * 1024 * 1024,
  stackBytes: 256 * 1024,
  maxRestarts: 3,
  healthyTicks: 6000,
  movement: DEFAULT_MOVEMENT_BALANCE,
  combat: DEFAULT_COMBAT_BALANCE
}
