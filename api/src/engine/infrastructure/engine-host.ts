import { GameTimeSettings } from '../../../../lib/utils/game-time'
import { AppError } from '../../shared/domain/app-error'
import { Logger } from '../../shared/application/logger'
import { NO_TRACING, Tracing } from '../../shared/application/tracing'
import { EngineCore } from '../application/engine-core'
import {
  ControlMessage,
  EngineMessage,
  EngineReplyData,
  EngineRequest,
  MessageChannel
} from '../application/engine-protocol'
import { EngineEvent, EngineSink } from '../application/engine-ports'
import { TickLoop, Timers } from './tick-loop'

// Forwards the engine's events over the channel
export class ChannelSink implements EngineSink {
  constructor(
    private readonly channel: MessageChannel<ControlMessage, EngineMessage>,
    private readonly tracing: Tracing = NO_TRACING
  ) {}

  // The event carries the trace it was raised in (a tick, a request), which the notifications it causes continue
  emit(event: EngineEvent): void {
    this.channel.post({ kind: 'event', event, traceparent: this.tracing.traceparent() })
  }
}

// The engine thread's side of the link: serves requests with the core, runs the tick loop and tells the API thread when it is
// ready (design §12.2.2)
export class EngineHost {
  private readonly loop: TickLoop

  constructor(
    private readonly core: EngineCore,
    private readonly channel: MessageChannel<ControlMessage, EngineMessage>,
    private readonly logger: Logger,
    tickIntervalMs: number,
    timers: Timers,
    // Applies the settings of the game's time; the host serves requests between ticks, so a change never lands inside one
    private readonly applyGameTime?: (settings: GameTimeSettings) => void,
    private readonly tracing: Tracing = NO_TRACING,
    // Runs after the engine has stopped and before the API thread is told: the thread must send its telemetry before it ends
    private readonly onStopped: () => Promise<void> = () => Promise.resolve()
  ) {
    this.loop = new TickLoop(
      () => core.runTick(),
      (error) => logger.error(error),
      tickIntervalMs,
      timers
    )
    channel.onMessage((message) => void this.handle(message))
  }

  // Relaunches what was running, starts ticking and announces itself
  async start(): Promise<void> {
    await this.core.recover()
    this.loop.start()
    this.channel.post({ kind: 'ready' })
  }

  async stop(): Promise<void> {
    await this.loop.stop()
    await this.core.shutdown()
  }

  private async handle(message: ControlMessage): Promise<void> {
    if (message.kind === 'stop') {
      await this.stop()
      await this.onStopped()
      this.channel.post({ kind: 'stopped' })
      return
    }
    const { id, request } = message
    // The span of the request lasts until the answer, so it includes the wait for the next tick
    await this.tracing.withSpan(`engine ${request.op}`, { kind: 'server', parent: message.traceparent }, async () => {
      try {
        this.channel.post({ kind: 'reply', id, data: await this.serve(request) })
      } catch (error) {
        this.channel.post({ kind: 'failure', id, error: this.serialize(error) })
      }
    })
  }

  private serve(request: EngineRequest): Promise<EngineReplyData> {
    switch (request.op) {
      case 'start':
        return this.core.start(request.request)
      case 'kill':
        return this.core.kill(request.userId, request.executionId)
      case 'list':
        return this.core.list(request.userId)
      case 'link':
        return this.core.link(request.userId, request.botId)
      case 'manual':
        return this.core.manual(request.userId, request.botId, request.fn, request.args)
      case 'act':
        return this.core.act(request.name, request.args)
      case 'control':
        return this.core.control(request.command)
      case 'setGameTime':
        this.applyGameTime?.(request.settings)
        return Promise.resolve(null)
      case 'reboot':
        return this.core.reboot(request.botId)
      case 'top':
        return this.core.top(request.limit)
      default:
        return Promise.resolve(this.core.snapshot())
    }
  }

  private serialize(error: unknown) {
    if (error instanceof AppError) {
      return { statusCode: error.statusCode, code: error.code, message: error.message }
    }
    this.logger.error(error)
    return { statusCode: 500, code: 'INTERNAL_ERROR', message: 'Internal error' }
  }
}
