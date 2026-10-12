import { IExecution } from '../../../../lib/utils/interfaces/executions'

export const SCRIPT_RUNNER = Symbol('ScriptRunner')

// An argument the player typed after the file name
export type ScriptArgument = string | number | boolean

// How the terminal starts, lists and stops the scripts of a player's bots (design §11.1, §12.3); the engine does the running
export interface ScriptRunner {
  // Runs `main(bot, ...args)` of a script file, addressed as `/<drive>/<path>` on the drives of the bot
  start(userId: string, botId: string, file: string, args: readonly ScriptArgument[]): Promise<IExecution>
  // Runs a line typed in shell mode with the bot in scope
  evaluate(userId: string, botId: string, code: string): Promise<IExecution>
  // The executions of the player that are still running
  list(userId: string): Promise<IExecution[]>
  kill(userId: string, executionId: string): Promise<IExecution>
}

// What a script wrote, for the log of the terminal (design §11.2.3)
export interface ScriptOutput {
  userId: string
  botId: string
  executionId: string
  kind: 'output' | 'error' | 'system'
  text: string
}

export const SCRIPT_OUTPUT_FEED = Symbol('ScriptOutputFeed')

// Where the lines scripts write come from; returns the function that stops listening
export interface ScriptOutputFeed {
  onOutput(listener: (output: ScriptOutput) => void): () => void
}
