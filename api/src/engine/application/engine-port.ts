import { ExecutionView } from '../domain/execution'
import { EngineMetricsSnapshot } from './engine-metrics'
import { EngineEvent } from './engine-ports'
import { StartRequest } from './engine-core'

export const ENGINE_PORT = Symbol('EnginePort')

// How the API thread reaches the engine (design §12.2.2, §14.2): every world-changing request is forwarded and answered
// by the engine, which is the single writer. Events (script logs, execution changes) come back to the listeners.
export interface EnginePort {
  start(request: StartRequest): Promise<ExecutionView>
  kill(userId: string, executionId: string): Promise<ExecutionView>
  list(userId: string): Promise<ExecutionView[]>
  metrics(): Promise<EngineMetricsSnapshot>
  // Returns the function that removes the listener
  onEvent(listener: (event: EngineEvent) => void): () => void
}
