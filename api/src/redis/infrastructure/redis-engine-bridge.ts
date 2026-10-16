import Redis from 'ioredis'
import { Logger } from '../../shared/application/logger'
import { NO_TRACING, Tracing } from '../../shared/application/tracing'
import { AppError } from '../../shared/domain/app-error'
import { EnginePort } from '../../engine/application/engine-port'
import { EngineReplyData, EngineRequest, SerializedError } from '../../engine/application/engine-protocol'
import { decode, encode, ENGINE_REQUEST_CHANNEL, LinkReply, LinkRequest } from './engine-link'

// The engine node's side of the link: answers the requests the API nodes publish by calling the local engine
export class RedisEngineBridge {
  constructor(
    private readonly engine: EnginePort,
    private readonly publisher: Redis,
    private readonly subscriber: Redis,
    private readonly logger: Logger,
    private readonly tracing: Tracing = NO_TRACING
  ) {}

  async open(): Promise<void> {
    this.subscriber.on(
      'messageBuffer',
      (_channel: Buffer, payload: Buffer) => void this.handle(decode<LinkRequest>(payload))
    )
    await this.subscriber.subscribe(ENGINE_REQUEST_CHANNEL)
  }

  private async handle({ id, replyTo, request, traceparent }: LinkRequest): Promise<void> {
    let reply: LinkReply | undefined
    await this.tracing.withSpan(`engine ${request.op}`, { kind: 'server', parent: traceparent }, async () => {
      try {
        reply = { id, data: await this.serve(request) }
      } catch (error) {
        reply = { id, error: this.serialize(error) }
      }
    })
    await this.publisher.publish(replyTo, encode(reply as LinkReply))
  }

  private serve(request: EngineRequest): Promise<EngineReplyData> {
    switch (request.op) {
      case 'start':
        return this.engine.start(request.request)
      case 'kill':
        return this.engine.kill(request.userId, request.executionId)
      case 'list':
        return this.engine.list(request.userId)
      case 'act':
        return this.engine.act(request.name, request.args as never) as Promise<EngineReplyData>
      case 'link':
        return this.engine.linkStatus(request.userId, request.botId)
      case 'manual':
        return this.engine.manual(request.userId, request.botId, request.fn, request.args)
      case 'control':
        return this.engine.control(request.command)
      case 'setGameTime':
        return this.engine.setGameTime(request.settings).then(() => null)
      case 'reboot':
        return this.engine.reboot(request.botId)
      case 'top':
        return this.engine.top(request.limit)
      default:
        return this.engine.metrics()
    }
  }

  private serialize(error: unknown): SerializedError {
    if (error instanceof AppError) {
      return { statusCode: error.statusCode, code: error.code, message: error.message }
    }
    this.logger.error(error)
    return { statusCode: 500, code: 'INTERNAL_ERROR', message: 'Internal error' }
  }
}
