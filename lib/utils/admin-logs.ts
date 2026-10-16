// The Logs and audit page of the admin console (design §25.3)
export const LOG_LEVELS = ['info', 'warn', 'error'] as const

export type LogLevelName = (typeof LOG_LEVELS)[number]

export const LOG_PAGE_MAX = 500

// Where the console reads the log from: the recent lines of the node that answers, or the store of every node
export const LOG_STORES = ['memory', 'elasticsearch'] as const

export type LogStoreName = (typeof LOG_STORES)[number]

export interface ILogLine {
  // Milliseconds since the epoch
  at: number
  level: LogLevelName
  message: string
  requestId: string | null
  // The trace the line was written in; every line of a request, a tick or a job has one
  traceId: string | null
  // The process that wrote it (host and process id) and the service in it (`botrts-api` or `botrts-engine`)
  node: string | null
  service: string | null
}

export interface ILogPage {
  lines: ILogLine[]
  // How many lines match
  total: number
  // How many lines the node keeps in all; null for the log store, which has no fixed size
  capacity: number | null
  store: LogStoreName
}

// A process that wrote to the log, for the node filter
export interface ILogNode {
  id: string
  services: string[]
}

export interface ISlowTick {
  tick: number
  durationMs: number
  intervalMs: number
  isCut: boolean
  queuedExecutions: number
  deferredExecutions: number
}
