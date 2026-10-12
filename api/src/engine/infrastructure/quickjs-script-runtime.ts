import { createRequire } from 'module'
import { importCandidates } from '../domain/module-path'
import releaseSyncVariant from '@jitl/quickjs-wasmfile-release-sync'
import {
  newQuickJSWASMModuleFromVariant,
  QuickJSContext,
  QuickJSDeferredPromise,
  QuickJSHandle,
  QuickJSRuntime,
  QuickJSSyncVariant,
  QuickJSWASMModule
} from 'quickjs-emscripten'
import { JsonValue } from '../domain/json-value'
import { ScriptFailure, ScriptFailureCode } from '../domain/script-failure'
import {
  PendingCall,
  ScriptExecution,
  ScriptExecutionOptions,
  ScriptRuntime,
  StepOutcome
} from '../application/script-runtime'

// Runs inside the VM before any player code. It builds the `bot` object from the whitelisted functions only and keeps the
// host bridge in a closure, so the player code never gets a reference to it (design §13: the predefined functions are the
// only door out). `Date` is removed and `Math.random` is seeded by the host: scripts have no clock (design §12.4).
const PRELUDE = `(function (call, random, time, log, configJson) {
  'use strict'
  const stringify = JSON.stringify
  const config = JSON.parse(configJson)
  const bot = {}
  for (const key of Object.keys(config.identity)) bot[key] = config.identity[key]
  for (const name of config.functions) {
    const fn = (...args) => call(name, stringify(args))
    bot[name] = fn
    globalThis[name] = fn
  }
  bot.log = (...args) => log(stringify(args))
  bot.time = () => time()
  globalThis.log = bot.log
  globalThis.time = bot.time
  Math.random = () => random()
  delete globalThis.Date
  return Object.freeze(bot)
})`

const INTERRUPTED = 'interrupted'

// The stock variant loads its WASM glue with a dynamic import, which Jest's module system refuses; a plain require of the
// same file works in Node and in the tests
const nodeRequire = createRequire(__filename)

const variant: QuickJSSyncVariant = {
  ...releaseSyncVariant,
  importModuleLoader: () =>
    Promise.resolve(nodeRequire('@jitl/quickjs-wasmfile-release-sync/emscripten-module').default)
}

export class QuickJsScriptRuntime implements ScriptRuntime {
  private constructor(
    private readonly module: QuickJSWASMModule,
    private readonly wallClock: () => number
  ) {}

  // Loading the WASM module is asynchronous, so the runtime is built by a factory; `wallClock` measures slices only
  static async create(wallClock: () => number = () => performance.now()): Promise<QuickJsScriptRuntime> {
    return new QuickJsScriptRuntime(await newQuickJSWASMModuleFromVariant(variant), wallClock)
  }

  createExecution(options: ScriptExecutionOptions): ScriptExecution {
    return new QuickJsExecution(this.module.newRuntime(), options, this.wallClock)
  }
}

class QuickJsExecution implements ScriptExecution {
  private readonly context: QuickJSContext
  private readonly parseJson: QuickJSHandle
  private readonly bot: QuickJSHandle
  private readonly deferred = new Map<number, QuickJSDeferredPromise>()
  private calls: PendingCall[] = []
  private nextCallId = 1
  private mainPromise?: QuickJSHandle
  private outcome?: StepOutcome
  private isInterrupted = false
  private isDisposed = false

  constructor(
    private readonly runtime: QuickJSRuntime,
    private readonly options: ScriptExecutionOptions,
    private readonly wallClock: () => number
  ) {
    runtime.setMemoryLimit(options.limits.memoryBytes)
    runtime.setMaxStackSize(options.limits.stackBytes)
    runtime.setModuleLoader(
      (name) => options.modules.get(name) ?? { error: new Error(`Cannot find module "${name}"`) },
      (importer, requested) => {
        const found = this.resolveImport(importer, requested)
        return found ?? { error: new Error(`Cannot find module "${requested}"`) }
      }
    )
    this.context = runtime.newContext()
    this.parseJson = this.context.unwrapResult(this.context.evalCode('JSON.parse'))
    this.bot = this.buildBot()
  }

  // The loaded file an import names: the first of its candidates the loader brought
  private resolveImport(importer: string, requested: string): string | undefined {
    try {
      return importCandidates(importer, requested).find((path) => this.options.modules.has(path))
    } catch {
      return undefined
    }
  }

  step(sliceMs: number): StepOutcome {
    if (this.outcome) return this.outcome
    const deadline = this.wallClock() + sliceMs
    this.isInterrupted = false
    this.runtime.setInterruptHandler(() => {
      this.isInterrupted = this.wallClock() > deadline
      return this.isInterrupted
    })
    this.outcome = this.mainPromise ? this.advance() : this.start()
    return this.outcome ?? { status: 'waiting' }
  }

  takeCalls(): PendingCall[] {
    const taken = this.calls
    this.calls = []
    return taken
  }

  resolveCall(callId: number, value: JsonValue | undefined): void {
    const deferred = this.takeDeferred(callId)
    if (!deferred) return
    if (value === undefined) {
      deferred.resolve()
    } else {
      const handle = this.fromJson(value)
      deferred.resolve(handle)
      handle.dispose()
    }
    deferred.dispose()
  }

  rejectCall(callId: number, message: string): void {
    const deferred = this.takeDeferred(callId)
    if (!deferred) return
    const error = this.context.newError(message)
    deferred.reject(error)
    error.dispose()
    deferred.dispose()
  }

  hasReadyWork(): boolean {
    return this.runtime.hasPendingJob()
  }

  memoryBytes(): number {
    const usage = this.runtime.computeMemoryUsage()
    const bytes = Number(this.context.dump(usage).memory_used_size)
    usage.dispose()
    return bytes
  }

  dispose(): void {
    if (this.isDisposed) return
    this.isDisposed = true
    for (const deferred of this.deferred.values()) deferred.dispose()
    this.deferred.clear()
    this.mainPromise?.dispose()
    this.bot.dispose()
    this.parseJson.dispose()
    this.context.dispose()
    this.runtime.dispose()
  }

  private takeDeferred(callId: number): QuickJSDeferredPromise | undefined {
    const deferred = this.deferred.get(callId)
    this.deferred.delete(callId)
    return deferred
  }

  private buildBot(): QuickJSHandle {
    const ctx = this.context
    const call = ctx.newFunction('call', (nameHandle, argsHandle) =>
      this.enqueue(ctx.getString(nameHandle), ctx.getString(argsHandle))
    )
    const random = ctx.newFunction('random', () => ctx.newNumber(this.options.host.random()))
    const time = ctx.newFunction('time', () => ctx.newNumber(this.options.host.time()))
    const log = ctx.newFunction('log', (argsHandle) => {
      this.options.host.log(JSON.parse(ctx.getString(argsHandle)) as JsonValue[])
    })
    const config = ctx.newString(JSON.stringify({ identity: this.options.identity, functions: this.options.functions }))
    const prelude = this.context.unwrapResult(ctx.evalCode(PRELUDE))
    const bot = this.context.unwrapResult(ctx.callFunction(prelude, ctx.undefined, call, random, time, log, config))
    for (const handle of [call, random, time, log, config, prelude]) handle.dispose()
    return bot
  }

  // The host side of every game function: records the call and hands the script a promise the engine settles later
  private enqueue(fn: string, argsJson: string): QuickJSHandle {
    const deferred = this.context.newPromise()
    const callId = this.nextCallId++
    this.deferred.set(callId, deferred)
    this.calls.push({ callId, fn, args: JSON.parse(argsJson) as JsonValue[] })
    return deferred.handle
  }

  private start(): StepOutcome | undefined {
    const ctx = this.context
    const loaded = ctx.evalCode(this.options.source, this.options.fileName, { type: 'module' })
    if (loaded.error) return this.failed(this.describeError(loaded.error))
    const exports = loaded.value
    const main = ctx.getProp(exports, 'main')
    exports.dispose()
    if (ctx.typeof(main) !== 'function') {
      main.dispose()
      return this.failed({ code: ScriptFailureCode.NO_MAIN, message: 'The file must export a main function' })
    }
    const args = this.options.args.map((arg) => this.fromJson(arg))
    const started = ctx.callFunction(main, ctx.undefined, this.bot, ...args)
    for (const handle of [main, ...args]) handle.dispose()
    if (started.error) return this.failed(this.describeError(started.error))
    this.mainPromise = started.value
    return this.advance()
  }

  // Runs every ready continuation, then reads the state of main's promise
  private advance(): StepOutcome | undefined {
    const jobs = this.runtime.executePendingJobs()
    // QuickJS reports an error here only for jobs created by the host; a failing job of the script rejects its promise instead
    /* istanbul ignore next */
    if (jobs.error) return this.failed(this.describeError(jobs.error))
    const state = this.context.getPromiseState(this.mainPromise as QuickJSHandle)
    // A deadline that tripped inside a continuation other than main's own chain leaves main pending
    if (state.type === 'pending') return this.isInterrupted ? this.failed(this.timeLimit()) : undefined
    if (state.type === 'rejected') return this.failed(this.describeError(state.error))
    const value = this.context.dump(state.value) as JsonValue | undefined
    if (!state.notAPromise) state.value.dispose()
    return { status: 'finished', value }
  }

  private failed(failure: ScriptFailure): StepOutcome {
    return { status: 'failed', failure }
  }

  private describeError(handle: QuickJSHandle): ScriptFailure {
    // The script cannot catch the interrupt error, but reading it must not trip the deadline again
    this.runtime.removeInterruptHandler()
    const thrown = this.context.dump(handle) as { name?: unknown; message?: unknown } | string | null
    handle.dispose()
    const isError = typeof thrown === 'object' && thrown !== null && typeof thrown.message === 'string'
    const name = isError ? String(thrown.name) : 'Error'
    const message = isError
      ? String(thrown.message)
      : typeof thrown === 'string'
        ? thrown
        : String(JSON.stringify(thrown))
    if (this.isInterrupted || message === INTERRUPTED) return this.timeLimit()
    if (/out of memory/i.test(message)) {
      return { code: ScriptFailureCode.MEMORY_LIMIT, message: 'The memory limit was exceeded' }
    }
    const code = name === 'SyntaxError' ? ScriptFailureCode.SYNTAX_ERROR : ScriptFailureCode.SCRIPT_ERROR
    return { code, message: `${name}: ${message}` }
  }

  private timeLimit(): ScriptFailure {
    return { code: ScriptFailureCode.TIME_LIMIT, message: 'The time slice was exceeded' }
  }

  private fromJson(value: JsonValue): QuickJSHandle {
    const text = this.context.newString(JSON.stringify(value))
    const parsed = this.context.unwrapResult(this.context.callFunction(this.parseJson, this.context.undefined, text))
    text.dispose()
    return parsed
  }
}
