import { JsonValue } from './json-value'

// What the database remembers of an execution (design §12.3.1): it is active until it finishes or is killed. The finer
// states of design §12.3 (queued, running, suspended, awaiting) change every tick and live only in the engine.
export const ExecutionStatus = {
  ACTIVE: 'active',
  FINISHED: 'finished',
  KILLED: 'killed'
} as const

export type ExecutionStatus = (typeof ExecutionStatus)[keyof typeof ExecutionStatus]

export interface Execution {
  readonly id: string
  readonly botId: string
  readonly userId: string
  // The script file as `/<drive>/<path>` on the bot's drives
  readonly file: string
  readonly args: readonly JsonValue[]
  readonly status: ExecutionStatus
  // How many times the engine relaunched it after an unclean stop (design §12.3.1)
  readonly restarts: number
  // Why it ended: the error of a failed script, `killed`, `crash-loop`, … ; null while active and after a normal finish
  readonly reason: string | null
  readonly createdAt: Date
  readonly endedAt: Date | null
}

// The states `top` shows (design §12.3)
export const ExecutionState = {
  QUEUED: 'queued',
  RUNNING: 'running',
  SUSPENDED: 'suspended',
  AWAITING: 'awaiting',
  FINISHED: 'finished',
  KILLED: 'killed'
} as const

export type ExecutionState = (typeof ExecutionState)[keyof typeof ExecutionState]

// An execution as a client sees it
export interface ExecutionView {
  readonly id: string
  readonly botId: string
  readonly file: string
  readonly args: readonly JsonValue[]
  readonly state: ExecutionState
  readonly reason: string | null
  readonly restarts: number
}
