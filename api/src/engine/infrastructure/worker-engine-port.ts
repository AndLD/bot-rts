import { AppError } from '../../shared/domain/app-error'
import { GameTimeSettings } from '../../../../lib/utils/game-time'
import { ExecutionUsage, ExecutionView } from '../domain/execution'
import { JsonValue } from '../domain/json-value'
import { StartRequest } from '../application/engine-core'
import { ControlState, EngineControl } from '../domain/engine-control'
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
import { NO_TRACING, Span, Tracing } from '../../shared/application/tracing'
import { LinkStatus } from '../application/radio-network'
import { WorldActionName, WorldActions } from '../application/world-actions'

interface Waiting {
  resolve(data: EngineReplyData): void
  reject(error: unknown): void
  // The span of the round trip, ended when the engine answers
  span: Span
}

// The API thread's side of the link to the engine thread: a request/reply protocol with ids over the channel, and the fan-out
// of the engine's events (design §12.2.2)
export class ChannelEnginePort implements EnginePort {
  private readonly waiting = new Map<number, Waiting>()
  private readonly listeners = new Set<(event: EngineEvent) => void>()
  private nextId = 1

  constructor(
    private readonly channel: MessageChannel<EngineMessage, ControlMessage>,
    private readonly tracing: Tracing = NO_TRACING
  ) {
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

  control(command: EngineControl): Promise<ControlState> {
    return this.ask({ op: 'control', command }) as Promise<ControlState>
  }

  async setGameTime(settings: GameTimeSettings): Promise<void> {
    await this.ask({ op: 'setGameTime', settings })
  }

  reboot(botId: string): Promise<ExecutionView[]> {
    return this.ask({ op: 'reboot', botId }) as Promise<ExecutionView[]>
  }

  top(limit: number): Promise<ExecutionUsage[]> {
    return this.ask({ op: 'top', limit }) as Promise<ExecutionUsage[]>
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
      waiting.span.fail('the engine is gone')
      waiting.span.end()
      waiting.reject(new ServiceUnavailableError())
    }
    this.waiting.clear()
  }

  private ask(request: EngineRequest): Promise<EngineReplyData> {
    return new Promise((resolve, reject) => {
      const id = this.nextId++
      const span = this.tracing.startSpan(`engine ${request.op}`, { kind: 'client' })
      this.waiting.set(id, { resolve, reject, span })
      try {
        this.channel.post({ kind: 'request', id, request, traceparent: span.traceparent })
      } catch (error) {
        this.waiting.delete(id)
        span.fail(error)
        span.end()
        reject(error)
      }
    })
  }

  private receive(message: EngineMessage): void {
    if (message.kind === 'event') {
      // What the listeners do about the event (a notification, say) belongs to the trace the engine raised it in
      this.tracing.withSpan(
        `engine event ${message.event.type}`,
        { kind: 'consumer', parent: message.traceparent },
        () => this.listeners.forEach((listener) => listener(message.event))
      )
      return
    }
    if (message.kind === 'ready' || message.kind === 'stopped') {
      return
    }
    const waiting = this.waiting.get(message.id)
    this.waiting.delete(message.id)
    if (message.kind === 'reply') {
      waiting?.span.end()
      waiting?.resolve(message.data)
    } else {
      waiting?.span.fail(message.error.code)
      waiting?.span.end()
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

  control(): Promise<ControlState> {
    return Promise.reject(new ServiceUnavailableError())
  }

  // There is no engine to tell: the settings are stored, and an engine that starts later reads them
  setGameTime(): Promise<void> {
    return Promise.resolve()
  }

  reboot(): Promise<ExecutionView[]> {
    return Promise.reject(new ServiceUnavailableError())
  }

  top(): Promise<ExecutionUsage[]> {
    return Promise.reject(new ServiceUnavailableError())
  }

  metrics(): Promise<EngineMetricsSnapshot> {
    return Promise.reject(new ServiceUnavailableError())
  }

  onEvent(): () => void {
    return () => undefined
  }
}
