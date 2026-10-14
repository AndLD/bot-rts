import { Execution } from '../../engine/domain/execution'
import { LocationRange } from '../../map/domain/map-point.entity'

export const INSPECTOR_READ_MODEL = Symbol('InspectorReadModel')

export interface InspectorLogLine {
  at: Date
  kind: string
  text: string
}

// What the inspector reads that no feature offers as a port: the executions and the terminal log of a bot, and where scripts run
export interface InspectorReadModel {
  recentExecutions(botId: string, limit: number): Promise<Execution[]>
  recentLogs(botId: string, limit: number): Promise<InspectorLogLine[]>
  // The places of the bots that have an active execution, inside the range
  activeExecutionLocations(range: LocationRange): Promise<Array<{ x: number; y: number }>>
}
