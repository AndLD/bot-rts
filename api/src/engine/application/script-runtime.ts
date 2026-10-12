import { JsonValue } from '../domain/json-value'
import { ScriptFailure } from '../domain/script-failure'

// The only functions of the host a script can use besides the game API: they cannot fail and cost no ops
export interface ScriptHost {
  // A seeded random float in [0, 1) replacing Math.random (design §12.4)
  random(): number
  // The game time in milliseconds replacing the clock (design §12.4)
  time(): number
  // Appends a line to the execution's log
  log(args: JsonValue[]): void
}

export interface ScriptLimits {
  memoryBytes: number
  stackBytes: number
}

export interface ScriptExecutionOptions {
  // The source of the entry file; it exports `main(bot, ...args)` (design §10.1)
  source: string
  fileName: string
  args: JsonValue[]
  // Plain data copied onto the `bot` object (its identity)
  identity: Record<string, JsonValue>
  // The game functions the bot's modules grant (design §10.2); each is a method of `bot` and a global
  functions: readonly string[]
  host: ScriptHost
  limits: ScriptLimits
}

// A game-API call a script made; the engine decides when it runs and settles it with resolveCall / rejectCall
export interface PendingCall {
  callId: number
  fn: string
  args: JsonValue[]
}

export type StepOutcome =
  | { status: 'waiting' } // the script awaits a call (or sleep); nothing more can run until one is settled
  | { status: 'finished'; value: JsonValue | undefined }
  | { status: 'failed'; failure: ScriptFailure }

export interface ScriptExecution {
  // Runs the script (the first step starts `main`) and its ready continuations until it must wait, finishes, or the slice ends
  step(sliceMs: number): StepOutcome
  // The calls made since the last time this was called, in the order they were made
  takeCalls(): PendingCall[]
  // Settles a call: the script's promise resolves with the value (undefined for calls without data)
  resolveCall(callId: number, value: JsonValue | undefined): void
  // Settles a call as misuse: the script's promise rejects with an Error (design §10.3)
  rejectCall(callId: number, message: string): void
  // True while the script has continuations ready to run (a settled call or a resolved promise)
  hasReadyWork(): boolean
  memoryBytes(): number
  dispose(): void
}

// Sandboxed execution of player code behind an interface, so the engine can be swapped (design §13)
export interface ScriptRuntime {
  createExecution(options: ScriptExecutionOptions): ScriptExecution
}
