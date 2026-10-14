import { EXECUTION_SHORT_ID_LENGTH } from '../../../../lib/utils/interfaces/executions'
import { TERMINAL_LOG_KIND } from '../../../../lib/utils/interfaces/terminal'
import { Clock } from '../../shared/application/clock'
import { Logger } from '../../shared/application/logger'
import { PendingLine } from './session-log-writer'
import { ScriptOutput, ScriptOutputFeed } from './script-runner'
import { TerminalService } from './terminal.service'

interface BotBuffer {
  userId: string
  lines: PendingLine[]
}

export interface ScriptLogRecorderOptions {
  // How long lines are collected before they are stored
  flushMs: number
  // The most lines kept waiting per bot: the oldest are dropped, as the line cap of the bot would drop them anyway
  maxLinesPerBot: number
}

// Stores every line a script writes in the terminal log of its bot, also while the player is away (design §11.2.3). Lines are
// collected per bot and stored in batches: a busy script writes hundreds of lines per second, and a statement per line made the
// queue of pending writes grow without end (found by the soak test, Phase 8.6). Memory is bounded by `maxLinesPerBot` per bot.
export class ScriptLogRecorder {
  private stop: (() => void) | null = null
  private readonly buffers = new Map<string, BotBuffer>()
  private timer: NodeJS.Timeout | null = null
  private draining: Promise<void> | null = null

  constructor(
    private readonly feed: ScriptOutputFeed,
    private readonly terminal: TerminalService,
    private readonly clock: Clock,
    private readonly logger: Logger,
    private readonly options: ScriptLogRecorderOptions
  ) {}

  start(): void {
    this.stop = this.feed.onOutput((output) => this.enqueue(output))
  }

  async shutdown(): Promise<void> {
    this.stop?.()
    this.stop = null
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    await this.drain()
  }

  private enqueue({ userId, botId, executionId, kind, text }: ScriptOutput): void {
    // `[<execution>] <text>` shows in the history which script said what
    const line: PendingLine = {
      kind: kind === 'error' ? TERMINAL_LOG_KIND.ERROR : TERMINAL_LOG_KIND.OUTPUT,
      text: `[${executionId.slice(0, EXECUTION_SHORT_ID_LENGTH)}] ${text}`,
      at: this.clock.now()
    }
    const buffer = this.buffers.get(botId) ?? { userId, lines: [] }

    buffer.lines.push(line)
    if (buffer.lines.length > this.options.maxLinesPerBot) {
      buffer.lines.splice(0, buffer.lines.length - this.options.maxLinesPerBot)
    }
    this.buffers.set(botId, buffer)

    if (!this.timer) {
      this.timer = setTimeout(() => {
        this.timer = null
        void this.drain()
      }, this.options.flushMs)
      this.timer.unref()
    }
  }

  // Stores what is collected, one pass at a time: while the database is busy the lines wait in their (capped) buffers, so a slow
  // database costs lines that the cap would drop anyway and never memory. A pass goes on until nothing is waiting.
  private drain(): Promise<void> {
    this.draining ??= (async () => {
      while (this.buffers.size) {
        const batches = [...this.buffers.entries()]
        this.buffers.clear()
        for (const [botId, { userId, lines }] of batches) {
          try {
            await this.terminal.recordScriptOutputs(userId, botId, lines)
          } catch (error) {
            this.logger.error(error)
          }
        }
      }
    })().finally(() => {
      this.draining = null
    })

    return this.draining
  }
}
