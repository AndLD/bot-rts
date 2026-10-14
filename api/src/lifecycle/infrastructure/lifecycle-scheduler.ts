// Calls `run` after `firstDelayMs` and then every `intervalMs`, never two at once; a pass that fails is the job's own business
export class LifecycleScheduler {
  private timer: NodeJS.Timeout | null = null
  private isRunning = false

  constructor(
    private readonly run: () => Promise<unknown>,
    private readonly intervalMs: number,
    private readonly firstDelayMs: number
  ) {}

  start(): void {
    this.timer = setTimeout(() => void this.tick(), this.firstDelayMs)
    this.timer.unref()
  }

  stop(): void {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }

  private async tick(): Promise<void> {
    if (!this.timer) {
      return
    }
    if (!this.isRunning) {
      this.isRunning = true
      try {
        await this.run()
      } catch {
        // The service records and logs its failures; a thrown one must not end the schedule
      } finally {
        this.isRunning = false
      }
    }
    if (this.timer) {
      this.timer = setTimeout(() => void this.tick(), this.intervalMs)
      this.timer.unref()
    }
  }
}
