import { ControlState } from '../domain/engine-control'

export const CONTROL_STATE_STORE = Symbol('ControlStateStore')

// Where the control state survives a restart. The engine writes it; the console reads it.
export interface ControlStateStore {
  load(): Promise<ControlState>
  save(state: ControlState): Promise<void>
}
