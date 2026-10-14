import { randomUUID } from 'crypto'
import Redis from 'ioredis'
import { AppError } from '../../shared/domain/app-error'
import { ExecutionView } from '../../engine/domain/execution'
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
    private readonly timeoutMs: number
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

  reboot(botId: string): Promise<ExecutionView[]> {
    return this.ask({ op: 'reboot', botId }) as Promise<ExecutionView[]>
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
      waiting.reject(new ServiceUnavailableError())
    }
    this.waiting.clear()
  }

  private async ask(request: EngineRequest): Promise<EngineReplyData> {
    const id = randomUUID()
    const answer = new Promise<EngineReplyData>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.waiting.delete(id)
        reject(new ServiceUnavailableError())
      }, this.timeoutMs)
      this.waiting.set(id, { resolve, reject, timer })
    })

    try {
      // Publishing returns how many engine nodes heard the request: nobody listening means the engine is down
      const listeners = await this.publisher.publish(
        ENGINE_REQUEST_CHANNEL,
        encode({ id, replyTo: engineReplyChannel(this.nodeId), request })
      )
      if (listeners === 0) {
        this.settle(id)?.reject(new ServiceUnavailableError())
      }
    } catch {
      this.settle(id)?.reject(new ServiceUnavailableError())
    }

    return answer
  }

  private receive(reply: LinkReply): void {
    const waiting = this.settle(reply.id)
    if (!waiting) {
      return
    }
    if ('error' in reply) {
      waiting.reject(new AppError(reply.error.statusCode, reply.error.code, reply.error.message))
    } else {
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
