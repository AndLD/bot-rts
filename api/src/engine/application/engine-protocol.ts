import { ExecutionView } from '../domain/execution'
import { EngineMetricsSnapshot } from './engine-metrics'
import { StartRequest } from './engine-core'
import { EngineEvent } from './engine-ports'

// The messages between the API thread and the engine thread: plain JSON, so the engine can later move to another process
// or a worker pool without changing the game logic (design §12.2.2)

export type EngineRequest =
  | { op: 'start'; request: StartRequest }
  | { op: 'kill'; userId: string; executionId: string }
  | { op: 'list'; userId: string }
  | { op: 'metrics' }

export type EngineReplyData = ExecutionView | ExecutionView[] | EngineMetricsSnapshot

export interface SerializedError {
  statusCode: number
  code: string
  message: string
}

// API thread -> engine
export interface RequestMessage {
  kind: 'request'
  id: number
  request: EngineRequest
}

// API thread -> engine: finish what is running and stop (a deliberate stop is not a crash)
export interface StopMessage {
  kind: 'stop'
}

export type ControlMessage = RequestMessage | StopMessage

// Engine -> API thread
export type EngineMessage =
  | { kind: 'ready' }
  | { kind: 'stopped' }
  | { kind: 'reply'; id: number; data: EngineReplyData }
  | { kind: 'failure'; id: number; error: SerializedError }
  | { kind: 'event'; event: EngineEvent }

// One end of the link between the threads
export interface MessageChannel<Incoming, Outgoing> {
  post(message: Outgoing): void
  onMessage(handler: (message: Incoming) => void): void
}
