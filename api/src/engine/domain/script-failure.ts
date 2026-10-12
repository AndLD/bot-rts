// Why a script execution ended abnormally (design §10.3, §13): a throw is misuse, a limit is the sandbox protecting the server
export const ScriptFailureCode = {
  SCRIPT_ERROR: 'SCRIPT_ERROR', // the script threw, or a call was rejected as misuse
  SYNTAX_ERROR: 'SYNTAX_ERROR', // the source does not parse
  NO_MAIN: 'NO_MAIN', // the entry file does not export a main function
  TIME_LIMIT: 'TIME_LIMIT', // the wall-clock slice of a tick was exceeded
  MEMORY_LIMIT: 'MEMORY_LIMIT' // the heap limit was exceeded
} as const

export type ScriptFailureCode = (typeof ScriptFailureCode)[keyof typeof ScriptFailureCode]

export interface ScriptFailure {
  code: ScriptFailureCode
  message: string
}
