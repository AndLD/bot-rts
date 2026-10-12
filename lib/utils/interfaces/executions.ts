// Terminals show an execution by the first characters of its id, and `kill` accepts them
export const EXECUTION_SHORT_ID_LENGTH = 8

// An execution of a script as a client sees it (design §12.3); `state` is one of the states `top` shows
export interface IExecution {
  id: string
  botId: string
  file: string
  args: readonly unknown[]
  state: 'queued' | 'running' | 'suspended' | 'awaiting' | 'finished' | 'killed'
  reason: string | null
  restarts: number
}

// A line a script wrote (`bot.log`), an error that ended it, or a note of the engine (design §11.2.3)
export interface IScriptLog {
  executionId: string
  botId: string
  kind: 'output' | 'error' | 'system'
  text: string
}
