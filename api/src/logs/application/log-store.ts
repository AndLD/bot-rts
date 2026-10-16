import { LogLevelName, LogStoreName } from '../../../../lib/utils/admin-logs'

export const LOG_STORE = Symbol('LogStore')

export interface LogQuery {
  // Words or an id that the line contains
  text?: string
  level?: LogLevelName
  requestId?: string
  traceId?: string
  // Ids of a player or a bot that the line names
  userId?: string
  botId?: string
  // A process, as the node list names it
  node?: string
  from?: Date
  to?: Date
}

export interface LogEntry {
  at: Date
  level: LogLevelName
  message: string
  requestId: string | null
  traceId: string | null
  node: string | null
  service: string | null
}

// A page of the newest matching lines: `limit` of them, after the `offset` newest
export interface LogPageRequest {
  limit: number
  offset: number
}

export interface LogSearchResult {
  entries: LogEntry[]
  total: number
  // How many lines the store keeps in all, when that is fixed
  capacity: number | null
}

export interface LogNodeInfo {
  id: string
  services: string[]
}

// Where the console searches the log (design §25.3): the recent lines of this process, or the lines of every node
export interface LogStore {
  readonly name: LogStoreName
  search(query: LogQuery, page: LogPageRequest): Promise<LogSearchResult>
  nodes(): Promise<LogNodeInfo[]>
}
