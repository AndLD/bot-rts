import { IExecution } from '../../../../lib/utils/interfaces/executions'
import { ScriptArgument, ScriptOutput, ScriptOutputFeed, ScriptRunner } from '../../terminal/application/script-runner'
import { SHELL_FILE } from '../domain/shell-script'
import { EnginePort } from '../application/engine-port'

// Starts, lists and stops scripts in the engine, and passes on what they write
export class EngineScriptRunner implements ScriptRunner, ScriptOutputFeed {
  constructor(private readonly engine: Pick<EnginePort, 'start' | 'list' | 'kill' | 'onEvent'>) {}

  start(userId: string, botId: string, file: string, args: readonly ScriptArgument[]): Promise<IExecution> {
    return this.engine.start({ userId, botId, file, args: [...args] })
  }

  evaluate(userId: string, botId: string, code: string): Promise<IExecution> {
    return this.engine.start({ userId, botId, file: SHELL_FILE, args: [code] })
  }

  list(userId: string): Promise<IExecution[]> {
    return this.engine.list(userId)
  }

  kill(userId: string, executionId: string): Promise<IExecution> {
    return this.engine.kill(userId, executionId)
  }

  onOutput(listener: (output: ScriptOutput) => void): () => void {
    return this.engine.onEvent((event) => {
      if (event.type === 'log') {
        listener(event)
      }
    })
  }
}
