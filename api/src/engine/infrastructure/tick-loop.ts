export interface Timers {
  now(): number
  // Calls `callback` after `delayMs`; returns the function that cancels it
  after(delayMs: number, callback: () => void): () => void
}

export const SYSTEM_TIMERS: Timers = {
  now: () => performance.now(),
  after: (delayMs, callback) => {
    const handle = setTimeout(callback, delayMs)
    return () => clearTimeout(handle)
  }
}

// Calls `onTick` at a fixed rate. The next tick is due one interval after the previous one was due, not after it finished,
// so a slow tick is followed by a short wait and the average rate holds; a tick that is more than an interval late does not
// make up the lost ones. A failing tick is reported and the loop goes on.
export class TickLoop {
  private cancel: (() => void) | null = null
  private dueAt = 0

  constructor(
    private readonly onTick: () => Promise<void>,
    private readonly onError: (error: unknown) => void,
    private readonly intervalMs: number,
    private readonly timers: Timers
  ) {}

  get isRunning(): boolean {
    return this.cancel !== null
  }

  start(): void {
    if (this.isRunning) {
      return
    }
    this.dueAt = this.timers.now() + this.intervalMs
    this.schedule()
  }

  stop(): void {
    this.cancel?.()
    this.cancel = null
  }

  private schedule(): void {
    this.cancel = this.timers.after(Math.max(0, this.dueAt - this.timers.now()), () => void this.run())
  }

  private async run(): Promise<void> {
    try {
      await this.onTick()
    } catch (error) {
      this.onError(error)
    }
    if (this.cancel) {
      this.dueAt = Math.max(this.dueAt + this.intervalMs, this.timers.now())
      this.schedule()
    }
  }
}
