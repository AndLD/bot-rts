import { Logger } from '../../shared/application/logger'
import { ControlMessage, EngineMessage, MessageChannel } from '../application/engine-protocol'
import { ServiceUnavailableError } from '../domain/engine.errors'
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
}

// Runs the engine thread and keeps it running (design §12.2.2: one authoritative engine; "if the engine process dies, the
// game pauses until it restarts"). Requests wait in the engine's inbox, so an engine that is down fails them with
// "unavailable" and the next one starts from the durable execution records (design §12.3.1).
export class EngineProcess {
  readonly port: ChannelEnginePort
  private worker: WorkerLike | null = null
  private isClosing = false
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
    })
  }

  // Asks the engine to finish and stop, then ends the thread
  async close(): Promise<void> {
    this.isClosing = true
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
