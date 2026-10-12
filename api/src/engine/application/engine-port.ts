import { ExecutionView } from '../domain/execution'
import { EngineMetricsSnapshot } from './engine-metrics'
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
  metrics(): Promise<EngineMetricsSnapshot>
  // Returns the function that removes the listener
  onEvent(listener: (event: EngineEvent) => void): () => void
}
