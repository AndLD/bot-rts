import { JsonValue } from '../domain/json-value'
import { ExecutionUsage, ExecutionView } from '../domain/execution'
import { ControlState, EngineControl } from '../domain/engine-control'
import { EngineMetricsSnapshot } from './engine-metrics'
import { LinkStatus } from './radio-network'
import { EngineEvent } from './engine-ports'
import { StartRequest } from './engine-core'
import { WorldActionName, WorldActions } from './world-actions'

export const ENGINE_PORT = Symbol('EnginePort')

// How the API thread reaches the engine (design §12.2.2, §14.2): every world-changing request is forwarded and answered
// by the engine, which is the single writer. Events (script logs, execution changes) come back to the listeners.
export interface EnginePort {
  start(request: StartRequest): Promise<ExecutionView>
  kill(userId: string, executionId: string): Promise<ExecutionView>
  list(userId: string): Promise<ExecutionView[]>
  // Runs a use case that changes the world in the engine, between its ticks (design §14.2), and returns what it returns
  act<K extends WorldActionName>(name: K, args: Parameters<WorldActions[K]>): ReturnType<WorldActions[K]>
  // A call of the script API made by hand (design §15.1), with the rules and the answer of a script's call
  manual(userId: string, botId: string, fn: string, args: JsonValue[]): Promise<JsonValue>
  // Whether a bot reaches its base through the radio network, and how well
  linkStatus(userId: string, botId: string): Promise<LinkStatus>
  // Maintenance, the script kill-switch and quarantine (design §25.3); answers the state after the change
  control(command: EngineControl): Promise<ControlState>
  // Kills and starts again the scripts of a bot
  reboot(botId: string): Promise<ExecutionView[]>
  // The running scripts that used the most ops, the biggest first
  top(limit: number): Promise<ExecutionUsage[]>
  metrics(): Promise<EngineMetricsSnapshot>
  // Returns the function that removes the listener
  onEvent(listener: (event: EngineEvent) => void): () => void
}
