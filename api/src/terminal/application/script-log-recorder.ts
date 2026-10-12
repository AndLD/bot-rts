import { EXECUTION_SHORT_ID_LENGTH } from '../../../../lib/utils/interfaces/executions'
import { TERMINAL_LOG_KIND } from '../../../../lib/utils/interfaces/terminal'
import { Logger } from '../../shared/application/logger'
import { ScriptOutput, ScriptOutputFeed } from './script-runner'
import { TerminalService } from './terminal.service'

// Stores every line a script writes in the terminal log of its bot, also while the player is away (design §11.2.3)
export class ScriptLogRecorder {
  private stop: (() => void) | null = null
  // The lines are stored one after another, so that two lines of a bot without a session do not open two
  private pending: Promise<unknown> = Promise.resolve()

  constructor(
    private readonly feed: ScriptOutputFeed,
    private readonly terminal: TerminalService,
    private readonly logger: Logger
  ) {}

  start(): void {
    this.stop = this.feed.onOutput((output) => this.enqueue(output))
  }

  shutdown(): Promise<unknown> {
    this.stop?.()
    return this.pending
  }

  private enqueue({ userId, botId, executionId, kind, text }: ScriptOutput): void {
    // `[<execution>] <text>` shows in the history which script said what
    const line = `[${executionId.slice(0, EXECUTION_SHORT_ID_LENGTH)}] ${text}`
    this.pending = this.pending
      .then(() =>
        this.terminal.recordScriptOutput(
          userId,
          botId,
          kind === 'error' ? TERMINAL_LOG_KIND.ERROR : TERMINAL_LOG_KIND.OUTPUT,
          line
        )
      )
      .catch((error) => this.logger.error(error))
  }
}
