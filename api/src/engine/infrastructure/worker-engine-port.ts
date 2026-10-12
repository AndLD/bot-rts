import { AppError } from '../../shared/domain/app-error'
import { ExecutionView } from '../domain/execution'
import { JsonValue } from '../domain/json-value'
import { StartRequest } from '../application/engine-core'
import { EngineMetricsSnapshot } from '../application/engine-metrics'
import { EnginePort } from '../application/engine-port'
import {
  ControlMessage,
  EngineMessage,
  EngineReplyData,
  EngineRequest,
  MessageChannel
} from '../application/engine-protocol'
import { EngineEvent } from '../application/engine-ports'
import { ServiceUnavailableError } from '../domain/engine.errors'
import { LinkStatus } from '../application/radio-network'
import { WorldActionName, WorldActions } from '../application/world-actions'

interface Waiting {
  resolve(data: EngineReplyData): void
  reject(error: unknown): void
}

// The API thread's side of the link to the engine thread: a request/reply protocol with ids over the channel, and the fan-out
// of the engine's events (design §12.2.2)
export class ChannelEnginePort implements EnginePort {
  private readonly waiting = new Map<number, Waiting>()
  private readonly listeners = new Set<(event: EngineEvent) => void>()
  private nextId = 1

  constructor(private readonly channel: MessageChannel<EngineMessage, ControlMessage>) {
    channel.onMessage((message) => this.receive(message))
  }

  start(request: StartRequest): Promise<ExecutionView> {
    return this.ask({ op: 'start', request }) as Promise<ExecutionView>
  }

  kill(userId: string, executionId: string): Promise<ExecutionView> {
    return this.ask({ op: 'kill', userId, executionId }) as Promise<ExecutionView>
  }

  list(userId: string): Promise<ExecutionView[]> {
    return this.ask({ op: 'list', userId }) as Promise<ExecutionView[]>
  }

  act<K extends WorldActionName>(name: K, args: Parameters<WorldActions[K]>): ReturnType<WorldActions[K]> {
    return this.ask({ op: 'act', name, args: [...args] }) as ReturnType<WorldActions[K]>
  }

  manual(userId: string, botId: string, fn: string, args: JsonValue[]): Promise<JsonValue> {
    return this.ask({ op: 'manual', userId, botId, fn, args }) as Promise<JsonValue>
  }

  linkStatus(userId: string, botId: string): Promise<LinkStatus> {
    return this.ask({ op: 'link', userId, botId }) as Promise<LinkStatus>
  }

  metrics(): Promise<EngineMetricsSnapshot> {
    return this.ask({ op: 'metrics' }) as Promise<EngineMetricsSnapshot>
  }

  onEvent(listener: (event: EngineEvent) => void): () => void {
    this.listeners.add(listener)
    return () => void this.listeners.delete(listener)
  }

  // The engine died or was stopped: everything waiting for it fails
  abandon(): void {
    for (const waiting of this.waiting.values()) {
      waiting.reject(new ServiceUnavailableError())
    }
    this.waiting.clear()
  }

  private ask(request: EngineRequest): Promise<EngineReplyData> {
    return new Promise((resolve, reject) => {
      const id = this.nextId++
      this.waiting.set(id, { resolve, reject })
      try {
        this.channel.post({ kind: 'request', id, request })
      } catch (error) {
        this.waiting.delete(id)
        reject(error)
      }
    })
  }

  private receive(message: EngineMessage): void {
    if (message.kind === 'event') {
      this.listeners.forEach((listener) => listener(message.event))
      return
    }
    if (message.kind === 'ready' || message.kind === 'stopped') {
      return
    }
    const waiting = this.waiting.get(message.id)
    this.waiting.delete(message.id)
    if (message.kind === 'reply') {
      waiting?.resolve(message.data)
    } else {
      waiting?.reject(new AppError(message.error.statusCode, message.error.code, message.error.message))
    }
  }
}

// What the API answers when the engine is switched off (tests, a deployment without game logic)
export class DisabledEnginePort implements EnginePort {
  start(): Promise<ExecutionView> {
    return Promise.reject(new ServiceUnavailableError())
  }

  kill(): Promise<ExecutionView> {
    return Promise.reject(new ServiceUnavailableError())
  }

  list(): Promise<ExecutionView[]> {
    return Promise.reject(new ServiceUnavailableError())
  }

  act<K extends WorldActionName>(): ReturnType<WorldActions[K]> {
    return Promise.reject(new ServiceUnavailableError()) as ReturnType<WorldActions[K]>
  }

  manual(): Promise<JsonValue> {
    return Promise.reject(new ServiceUnavailableError())
  }

  linkStatus(): Promise<LinkStatus> {
    return Promise.reject(new ServiceUnavailableError())
  }

  metrics(): Promise<EngineMetricsSnapshot> {
    return Promise.reject(new ServiceUnavailableError())
  }

  onEvent(): () => void {
    return () => undefined
  }
}
