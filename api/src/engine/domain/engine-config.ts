import { DEFAULT_MOVEMENT_BALANCE, MovementBalance } from '../../bots/domain/movement'
import { CombatBalance, DEFAULT_COMBAT_BALANCE } from '../../modules/domain/weapon-module'
import { DEFAULT_RADIO_BALANCE, RadioBalance } from './radio'

// What a script may import (design §10.1.1)
export interface ModuleLimits {
  // Bytes of one source file
  maxFileBytes: number
  // Files in one execution, the entry included
  maxFiles: number
  // Longest chain of imports, counted from the entry file
  maxDepth: number
  // Transpiled files kept by content hash
  cacheEntries: number
}

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
  // A write that fails this many times in a row is given up on and the memory is reloaded from the database
  flushMaxFailures: number
  // Limits of one script execution
  memoryBytes: number
  stackBytes: number
  // An execution found running after this many consecutive unclean restarts is killed instead of relaunched
  maxRestarts: number
  // An execution that has run this many ticks since its relaunch is healthy: its restart count is forgotten
  healthyTicks: number
  modules: ModuleLimits
  // Chunks of the map kept in memory; the least recently used are dropped (design §4.4)
  maxChunks: number
  // Game rules whose numbers the engine applies (design §8.5, §12.6)
  movement: MovementBalance
  combat: CombatBalance
  // The radio network: the margins of the signal bars, and what a bot out of reach keeps (design §11.2.1)
  radio: RadioBalance & { bufferScans: number; bufferEvents: number }
}

export const DEFAULT_ENGINE_CONFIG: EngineConfig = {
  tickIntervalMs: 100,
  sliceMs: 5,
  tickCapRatio: 0.8,
  flushEveryTicks: 10,
  flushMaxFailures: 3,
  memoryBytes: 4 * 1024 * 1024,
  stackBytes: 256 * 1024,
  maxRestarts: 3,
  healthyTicks: 6000,
  modules: { maxFileBytes: 32 * 1024, maxFiles: 20, maxDepth: 5, cacheEntries: 200 },
  maxChunks: 512,
  movement: DEFAULT_MOVEMENT_BALANCE,
  combat: DEFAULT_COMBAT_BALANCE,
  radio: { ...DEFAULT_RADIO_BALANCE, bufferScans: 1000, bufferEvents: 200 }
}
