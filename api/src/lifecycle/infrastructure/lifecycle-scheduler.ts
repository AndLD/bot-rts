// Calls `run` after `firstDelayMs` and then `intervalMs` after each pass has ended, so two passes never overlap; a pass that
// fails does not end the schedule
export class LifecycleScheduler {
  private timer: NodeJS.Timeout | null = null

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
    try {
      await this.run()
    } catch {
      // The service records and logs its failures; a thrown one must not end the schedule
    }
    if (this.timer) {
      this.timer = setTimeout(() => void this.tick(), this.intervalMs)
      this.timer.unref()
    }
  }
}
