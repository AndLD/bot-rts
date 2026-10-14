// The Logs and audit page of the admin console (design §25.3)
export const LOG_LEVELS = ['info', 'warn', 'error'] as const

export type LogLevelName = (typeof LOG_LEVELS)[number]

export const LOG_PAGE_MAX = 500

export interface ILogLine {
  // Milliseconds since the epoch
  at: number
  level: LogLevelName
  message: string
  requestId: string | null
}

export interface ILogPage {
  lines: ILogLine[]
  // How many lines match, and how many lines the node keeps in all
  total: number
  capacity: number
}

export interface ISlowTick {
  tick: number
  durationMs: number
  intervalMs: number
  isCut: boolean
  queuedExecutions: number
  deferredExecutions: number
}
