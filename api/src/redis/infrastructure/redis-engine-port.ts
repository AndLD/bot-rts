import { randomUUID } from 'crypto'
import { GameTimeSettings } from '../../../../lib/utils/game-time'
import Redis from 'ioredis'
import { AppError } from '../../shared/domain/app-error'
import { NO_TRACING, Span, Tracing } from '../../shared/application/tracing'
import { ExecutionUsage, ExecutionView } from '../../engine/domain/execution'
import { JsonValue } from '../../engine/domain/json-value'
import { ServiceUnavailableError } from '../../engine/domain/engine.errors'
import { StartRequest } from '../../engine/application/engine-core'
import { ControlState, EngineControl } from '../../engine/domain/engine-control'
import { EngineMetricsSnapshot } from '../../engine/application/engine-metrics'
import { EnginePort } from '../../engine/application/engine-port'
import { EngineReplyData, EngineRequest } from '../../engine/application/engine-protocol'
import { LinkStatus } from '../../engine/application/radio-network'
import { WorldActionName, WorldActions } from '../../engine/application/world-actions'
import { decode, encode, ENGINE_REQUEST_CHANNEL, engineReplyChannel, LinkReply } from './engine-link'

interface Waiting {
  resolve(data: EngineReplyData): void
  reject(error: unknown): void
  timer: NodeJS.Timeout
  // The span of the round trip over Redis
  span: Span
}

// The engine as an API node sees it when the engine runs on another node: requests go over Redis. The engine's events do
// not come back here: the engine node pushes them to the players' sockets through the Socket.IO Redis adapter, so this
// port has no events to hand out.
export class RedisEnginePort implements EnginePort {
  private readonly waiting = new Map<string, Waiting>()
  private readonly nodeId = randomUUID()

  constructor(
    private readonly publisher: Redis,
    private readonly subscriber: Redis,
    private readonly timeoutMs: number,
    private readonly tracing: Tracing = NO_TRACING
  ) {
    subscriber.on('messageBuffer', (_channel: Buffer, payload: Buffer) => this.receive(decode<LinkReply>(payload)))
  }

  // Resolves once the replies of this node are being listened to
  async open(): Promise<void> {
    await this.subscriber.subscribe(engineReplyChannel(this.nodeId))
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

  onEvent(): () => void {
    return () => undefined
  }

  close(): void {
    for (const waiting of this.waiting.values()) {
      clearTimeout(waiting.timer)
      waiting.span.fail('the link was closed')
      waiting.span.end()
      waiting.reject(new ServiceUnavailableError())
    }
    this.waiting.clear()
  }

  private async ask(request: EngineRequest): Promise<EngineReplyData> {
    const id = randomUUID()
    const span = this.tracing.startSpan(`engine ${request.op}`, { kind: 'client' })
    const answer = new Promise<EngineReplyData>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.waiting.delete(id)
        span.fail('the engine did not answer in time')
        span.end()
        reject(new ServiceUnavailableError())
      }, this.timeoutMs)
      this.waiting.set(id, { resolve, reject, timer, span })
    })

    try {
      // Publishing returns how many engine nodes heard the request: nobody listening means the engine is down
      const listeners = await this.publisher.publish(
        ENGINE_REQUEST_CHANNEL,
        encode({ id, replyTo: engineReplyChannel(this.nodeId), request, traceparent: span.traceparent })
      )
      if (listeners === 0) {
        this.abandon(id)
      }
    } catch {
      this.abandon(id)
    }

    return answer
  }

  // Nobody can answer: the request fails now and not after the timeout
  private abandon(id: string): void {
    const waiting = this.settle(id)
    waiting?.span.fail('no engine node is listening')
    waiting?.span.end()
    waiting?.reject(new ServiceUnavailableError())
  }

  private receive(reply: LinkReply): void {
    const waiting = this.settle(reply.id)
    if (!waiting) {
      return
    }
    if ('error' in reply) {
      waiting.span.fail(reply.error.code)
      waiting.span.end()
      waiting.reject(new AppError(reply.error.statusCode, reply.error.code, reply.error.message))
    } else {
      waiting.span.end()
      waiting.resolve(reply.data)
    }
  }

  private settle(id: string): Waiting | undefined {
    const waiting = this.waiting.get(id)
    if (waiting) {
      clearTimeout(waiting.timer)
      this.waiting.delete(id)
    }
    return waiting
  }
}
