export const TEST_PLAYER_DIRECTORY = Symbol('TestPlayerDirectory')

// Finds the accounts the dev tools made
export interface TestPlayerDirectory {
  // The ids of test players that are not erased yet
  activeIds(limit: number): Promise<string[]>
}

export const DATABASE_RESETTER = Symbol('DatabaseResetter')
export const ENGINE_RESTARTER = Symbol('EngineRestarter')

export interface ResetKeep {
  // The admin who pressed the button, and the login they used: they stay signed in
  actorId: string
  sessionId: string | undefined
}

// Empties the tables of the game (never the migrations or the audit log), keeping the owners and the actor with their logins
export interface DatabaseResetter {
  wipe(keep: ResetKeep): Promise<{ tablesEmptied: number; accountsErased: number }>
}

// Stops the engine (it finishes what it was writing) and starts it again, so that it reads the emptied world
export interface EngineRestarter {
  stop(): Promise<void>
  start(): Promise<void>
}
