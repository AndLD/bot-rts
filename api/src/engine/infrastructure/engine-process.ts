import { Logger } from '../../shared/application/logger'
import { EngineEvent } from '../application/engine-ports'
import { ControlMessage, EngineMessage, MessageChannel } from '../application/engine-protocol'
import { ServiceUnavailableError } from '../domain/engine.errors'
import { StepState } from './step-watch'
import { ChannelEnginePort } from './worker-engine-port'

// The part of a Node `Worker` the supervisor uses, so it can be replaced in tests
export interface WorkerLike {
  postMessage(message: ControlMessage): void
  on(event: 'message', listener: (message: EngineMessage) => void): void
  on(event: 'error', listener: (error: Error) => void): void
  on(event: 'exit', listener: (code: number) => void): void
  terminate(): Promise<number>
}

export interface EngineProcessOptions {
  spawn(): WorkerLike
  logger: Logger
  // How long to wait for the engine to announce itself, and to confirm a stop
  readyTimeoutMs: number
  stopTimeoutMs: number
  // The wait before an engine that died is started again
  respawnDelayMs: number
  // Ends an engine thread that stays inside one step of a script (plan 5.7)
  watchdog?: {
    reader: { read(): StepState; clear(): void }
    stallMs: number
    pollMs: number
    // Told which execution stalled the engine, after the thread is gone and before the next one starts
    onStall(executionId: string): Promise<void>
    // The time in ms
    now?: () => number
  }
}

// Runs the engine thread and keeps it running (design §12.2.2: one authoritative engine; "if the engine process dies, the
// game pauses until it restarts"). Requests wait in the engine's inbox, so an engine that is down fails them with
// "unavailable" and the next one starts from the durable execution records (design §12.3.1).
export class EngineProcess {
  readonly port: ChannelEnginePort
  private worker: WorkerLike | null = null
  private isClosing = false
  private watcher: NodeJS.Timeout | null = null
  // The step the watchdog saw last, and since when
  private seen = { sequence: -1, since: 0 }
  private isJudging = false
  private ready: (() => void) | null = null
  private stopped: (() => void) | null = null
  // Set by the port as soon as it is created
  private incoming!: (message: EngineMessage) => void

  constructor(private readonly options: EngineProcessOptions) {
    const channel: MessageChannel<EngineMessage, ControlMessage> = {
      post: (message) => {
        if (!this.worker) {
          throw new ServiceUnavailableError()
        }
        this.worker.postMessage(message)
      },
      onMessage: (handler) => void (this.incoming = handler)
    }
    this.port = new ChannelEnginePort(channel)
  }

  // Starts the engine thread and resolves when it is ready to serve
  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('The engine did not start in time')), this.options.readyTimeoutMs)
      this.ready = () => {
        clearTimeout(timer)
        resolve()
      }
      this.launch(reject)
      this.watch()
    })
  }

  // Hands an event to the listeners of the port as if the engine had sent it
  announce(event: EngineEvent): void {
    this.incoming({ kind: 'event', event })
  }

  // Asks the engine to finish and stop, then ends the thread
  async close(): Promise<void> {
    this.isClosing = true
    if (this.watcher) {
      clearInterval(this.watcher)
    }
    const worker = this.worker
    if (!worker) {
      return
    }
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, this.options.stopTimeoutMs)
      this.stopped = () => {
        clearTimeout(timer)
        resolve()
      }
      worker.postMessage({ kind: 'stop' })
    })
    this.worker = null
    await worker.terminate()
    this.port.abandon()
  }

  // Checks now and then that the engine is not stuck inside one step of a script: the sandbox's own clock is polled only every
  // few thousand instructions, so a script made of heavy builtins can hold the thread for many seconds. The thread is ended and
  // the script that held it is killed, so that the next engine does not start it again.
  private watch(): void {
    const watchdog = this.options.watchdog
    if (!watchdog) {
      return
    }
    const now = watchdog.now ?? Date.now
    this.watcher = setInterval(() => {
      const state = watchdog.reader.read()
      if (state.sequence !== this.seen.sequence) {
        this.seen = { sequence: state.sequence, since: now() }
        return
      }
      const isStuck = state.executionId !== null && now() - this.seen.since >= watchdog.stallMs
      if (isStuck && !this.isJudging && this.worker) {
        this.isJudging = true
        void this.judge(state.executionId as string).finally(() => (this.isJudging = false))
      }
    }, watchdog.pollMs)
    this.watcher.unref()
  }

  private async judge(executionId: string): Promise<void> {
    const worker = this.worker
    this.options.logger.warn(`The engine thread is stuck in execution ${executionId}; ending it`)
    this.seen = { sequence: -1, since: 0 }
    await worker?.terminate()
    this.options.watchdog?.reader.clear()
    try {
      await this.options.watchdog?.onStall(executionId)
    } catch (error) {
      this.options.logger.error(error)
    }
  }

  private launch(onStartFailure?: (error: Error) => void): void {
    const worker = this.options.spawn()
    this.worker = worker
    worker.on('message', (message) => {
      if (message.kind === 'ready') {
        this.ready?.()
        this.ready = null
      } else if (message.kind === 'stopped') {
        this.stopped?.()
      }
      this.incoming(message)
    })
    worker.on('error', (error) => {
      this.options.logger.error(error)
      onStartFailure?.(error)
    })
    worker.on('exit', (code) => {
      if (this.worker !== worker) {
        return
      }
      this.worker = null
      this.port.abandon()
      if (!this.isClosing) {
        this.options.logger.warn(`The engine thread exited with code ${code}; starting it again`)
        setTimeout(() => this.launch(), this.options.respawnDelayMs)
      }
    })
  }
}
