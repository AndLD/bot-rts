// What admins can change about the running world (design §25.3, Supervision). It is held by the engine, which is the single
// writer, and kept in the database so that a restart does not undo it.
export interface ControlState {
  // Maintenance: no tick runs, and nothing new starts, until an admin resumes
  isPaused: boolean
  // The global script kill-switch: running scripts were killed and no script starts until an admin switches it off
  areScriptsHalted: boolean
  // Players whose scripts are held (not stepped) and who cannot start scripts or act
  quarantined: string[]
}

export const INITIAL_CONTROL_STATE: ControlState = { isPaused: false, areScriptsHalted: false, quarantined: [] }

export type EngineControl =
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'halt-scripts'; isOn: boolean }
  | { type: 'quarantine'; userId: string; isOn: boolean }
