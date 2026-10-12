import { findScriptFunction, validateScriptArgs } from '../../../../lib/utils/script-api'
import { Execution, ExecutionState, ExecutionView } from '../domain/execution'
import { JsonValue } from '../domain/json-value'
import { PendingCall, ScriptExecution, StepOutcome } from './script-runtime'

// A game call a script made, waiting to be applied to the world
export interface EngineCommand {
  executionId: string
  botId: string
  callId: number
  fn: string
  args: JsonValue[]
}

// How the engine answers a call: a value for the script, or misuse that ends it
export type CallAnswer = { value: JsonValue | undefined } | { misuse: string }

// An execution the engine is running: the durable record plus the sandbox it runs in. It keeps the calls the script is
// waiting for apart from the ones it is sleeping on, and turns the answers into resolved promises at the start of a tick
// (design §12.2.2).
export class LiveExecution {
  private readonly sleepers = new Map<number, number>()
  private readonly answers: Array<{ callId: number; answer: CallAnswer }> = []
  private outstanding = 0
  private hasStarted = false

  constructor(
    private current: Execution,
    private readonly script: ScriptExecution,
    // The tick it was (re)launched at
    readonly sinceTick: number
  ) {}

  get record(): Execution {
    return this.current
  }

  update(record: Execution): void {
    this.current = record
  }

  // Resolves the calls whose answer or wake-up time has come
  settle(tick: number): void {
    for (const [callId, wakeTick] of [...this.sleepers]) {
      if (wakeTick <= tick) {
        this.sleepers.delete(callId)
        this.script.resolveCall(callId, undefined)
      }
    }
    for (const { callId, answer } of this.answers.splice(0)) {
      this.outstanding -= 1
      if ('misuse' in answer) {
        this.script.rejectCall(callId, answer.misuse)
      } else {
        this.script.resolveCall(callId, answer.value)
      }
    }
  }

  answer(callId: number, answer: CallAnswer): void {
    this.answers.push({ callId, answer })
  }

  // Whether stepping can make progress: the script has not started, or something it waits for was settled
  get isRunnable(): boolean {
    return !this.hasStarted || this.script.hasReadyWork()
  }

  // Runs the script for one slice; its game calls come back as commands, and sleeps are kept here
  step(tick: number, sliceMs: number, tickIntervalMs: number): { outcome: StepOutcome; commands: EngineCommand[] } {
    this.hasStarted = true
    const outcome = this.script.step(sliceMs)
    const commands: EngineCommand[] = []
    for (const call of this.script.takeCalls()) {
      const command = this.route(call, tick, tickIntervalMs)
      if (command) {
        commands.push(command)
      }
    }
    return { outcome, commands }
  }

  memoryBytes(): number {
    return this.script.memoryBytes()
  }

  dispose(): void {
    this.script.dispose()
  }

  view(): ExecutionView {
    return {
      id: this.current.id,
      botId: this.current.botId,
      file: this.current.file,
      args: this.current.args,
      state: this.state(),
      reason: this.current.reason,
      restarts: this.current.restarts
    }
  }

  private state(): ExecutionState {
    if (!this.hasStarted) {
      return ExecutionState.QUEUED
    }
    if (this.outstanding > 0) {
      return ExecutionState.AWAITING
    }
    return this.sleepers.size > 0 && !this.script.hasReadyWork() ? ExecutionState.SUSPENDED : ExecutionState.RUNNING
  }

  // `sleep` is served here, any other call goes to the engine
  private route(call: PendingCall, tick: number, tickIntervalMs: number): EngineCommand | null {
    if (call.fn !== 'sleep') {
      this.outstanding += 1
      return {
        executionId: this.current.id,
        botId: this.current.botId,
        callId: call.callId,
        fn: call.fn,
        args: call.args
      }
    }
    const spec = findScriptFunction('sleep')
    const problem = spec && validateScriptArgs(spec, call.args)
    if (problem || (call.args[0] as number) < 0) {
      this.script.rejectCall(call.callId, problem || 'sleep: ms must not be negative')
    } else {
      this.sleepers.set(call.callId, tick + Math.max(1, Math.ceil((call.args[0] as number) / tickIntervalMs)))
    }
    return null
  }
}
