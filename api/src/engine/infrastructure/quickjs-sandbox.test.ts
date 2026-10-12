import { DEFAULT_ENGINE_CONFIG } from '../domain/engine-config'
import { JsonValue } from '../domain/json-value'
import { ScriptExecution, ScriptExecutionOptions, StepOutcome } from '../application/script-runtime'
import { QuickJsScriptRuntime } from './quickjs-script-runtime'

// Attacks on the sandbox that a player's script might try (design §13, plan task 5.7): each must end as an ordinary failure of
// that script, never reach the host, and never hurt the executions around it.
describe('the script sandbox under attack', () => {
  let runtime: QuickJsScriptRuntime
  const logs: JsonValue[][] = []
  const executions: ScriptExecution[] = []

  const run = (source: string, overrides: Partial<ScriptExecutionOptions> = {}): ScriptExecution => {
    const execution = runtime.createExecution({
      source,
      fileName: 'main.js',
      modules: new Map(),
      args: [],
      identity: { id: 'bot-1' },
      functions: ['scan', 'sleep'],
      host: { random: () => 0.25, time: () => 1234, log: (args) => logs.push(args) },
      limits: { memoryBytes: 4 * 1024 * 1024, stackBytes: DEFAULT_ENGINE_CONFIG.stackBytes },
      ...overrides
    })
    executions.push(execution)
    return execution
  }

  const valueOf = (outcome: StepOutcome): JsonValue | undefined => {
    if (outcome.status !== 'finished') throw new Error(`expected finished, got ${JSON.stringify(outcome)}`)
    return outcome.value
  }

  const failureOf = (outcome: StepOutcome) => {
    if (outcome.status !== 'failed') throw new Error(`expected failed, got ${JSON.stringify(outcome)}`)
    return outcome.failure
  }

  beforeAll(async () => {
    runtime = await QuickJsScriptRuntime.create()
  })

  beforeEach(() => {
    logs.length = 0
  })

  afterEach(() => {
    executions.splice(0).forEach((execution) => execution.dispose())
  })

  it('offers no global that reaches the host, the file system, the network or other threads', () => {
    const source = `export async function main() {
      const names = Object.getOwnPropertyNames(globalThis)
      const banned = ['process', 'require', 'module', 'exports', 'Buffer', 'global', 'fetch', 'XMLHttpRequest', 'WebSocket',
        'setTimeout', 'setInterval', 'setImmediate', 'queueMicrotask', 'importScripts', 'Worker', 'SharedArrayBuffer',
        'Atomics', 'WebAssembly', 'std', 'os', 'scriptArgs', 'print', 'console', 'Date']
      return banned.filter((name) => names.includes(name))
    }`

    expect(valueOf(run(source).step(50))).toEqual([])
  })

  it('cannot load host modules by a dynamic import, with or without the node: prefix', () => {
    const source = `export async function main() {
      const outcomes = []
      for (const name of ['os', 'std', 'fs', 'node:fs', 'child_process', './../../etc/passwd', 'data:text/javascript,1']) {
        try { await import(name); outcomes.push('loaded ' + name) } catch (e) { outcomes.push('refused') }
      }
      return outcomes
    }`

    expect(valueOf(run(source).step(50))).toEqual(Array(7).fill('refused'))
  })

  it('cannot change the bot object, the calls it makes, or the prototypes the host relies on', () => {
    const source = `export async function main(bot) {
      const results = []
      for (const attack of [
        () => { bot.id = 'someone-else' },
        () => { bot.scan = () => 'forged' },
        () => { delete bot.log },
        () => { Object.defineProperty(bot, 'id', { value: 'x' }) },
        () => { Object.setPrototypeOf(bot, null) }
      ]) {
        try { attack(); results.push('changed') } catch (e) { results.push(e.name) }
      }
      return [results, bot.id, typeof bot.scan, typeof bot.log]
    }`

    expect(valueOf(run(source).step(50))).toEqual([Array(5).fill('TypeError'), 'bot-1', 'function', 'function'])
  })

  it('keeps executions apart: a polluted prototype or a changed global does not reach the next script', () => {
    const polluter = run(`export async function main() {
      Object.prototype.polluted = 'yes'
      Array.prototype.map = () => 'broken'
      globalThis.secret = 42
      return [].map(() => 1)
    }`)
    expect(valueOf(polluter.step(50))).toBe('broken')

    const victim = run(
      'export async function main() { return [{}.polluted === undefined, [1].map((n) => n + 1)[0], typeof globalThis.secret] }'
    )
    expect(valueOf(victim.step(50))).toEqual([true, 2, 'undefined'])
  })

  it('shows a script only its own identity and arguments', () => {
    const first = run('export async function main(bot, a) { return [bot.id, a] }', {
      identity: { id: 'bot-A' },
      args: ['mine']
    })
    const second = run('export async function main(bot, a) { return [bot.id, a] }', {
      identity: { id: 'bot-B' },
      args: ['yours']
    })

    expect(valueOf(first.step(50))).toEqual(['bot-A', 'mine'])
    expect(valueOf(second.step(50))).toEqual(['bot-B', 'yours'])
  })

  it('survives hostile values handed to bot.log: cycles, throwing getters, huge nesting', () => {
    const source = `export async function main(bot) {
      const results = []
      const cycle = {}; cycle.self = cycle
      const trap = { get boom() { throw new Error('getter') } }
      let deep = []; for (let i = 0; i < 50000; i++) deep = [deep]
      for (const value of [cycle, trap, deep, Symbol('s'), 10n]) {
        try { bot.log(value); results.push('logged') } catch (e) { results.push('error') }
      }
      bot.log('still alive')
      return results
    }`

    const outcome = run(source).step(2000)

    expect(outcome.status).toBe('finished')
    expect(logs[logs.length - 1]).toEqual(['still alive'])
  })

  it('keeps deeply nested values from overflowing the native stack inside a builtin, with the default stack limit', () => {
    const attacks = [
      'JSON.stringify(deep)',
      'String(deep)',
      'deep.join(",")',
      'deep.flat(Infinity)',
      'JSON.parse("[".repeat(50000) + "]".repeat(50000))'
    ]
    for (const attack of attacks) {
      const source = `export async function main() {
        let deep = []; for (let i = 0; i < 50000; i++) deep = [deep]
        try { ${attack} } catch (e) { return e.name }
        return 'no error'
      }`

      expect(valueOf(run(source).step(2000))).toMatch(/^(InternalError|SyntaxError|RangeError)$/)
    }
  })

  it('contains a fault of the sandbox itself: the execution ends, the engine and the next execution go on', async () => {
    // With a stack limit the thread cannot honour, the same attack overflows the host's own stack
    const attacker = run(
      'export async function main() { let deep = []; for (let i = 0; i < 50000; i++) deep = [deep]; JSON.stringify(deep) }',
      { limits: { memoryBytes: 4 * 1024 * 1024, stackBytes: 1024 * 1024 } }
    )

    expect(failureOf(attacker.step(2000)).code).toBe('SANDBOX_FAULT')
    expect(() => attacker.dispose()).not.toThrow()

    await new Promise((resolve) => setTimeout(resolve, 300))
    expect(valueOf(run('export async function main() { return 40 + 2 }').step(50))).toBe(42)
  })

  it('kills a script that hangs inside the host call that formats its log line', () => {
    const execution = run('export async function main(bot) { bot.log({ toJSON() { for (;;) {} } }) }')

    expect(failureOf(execution.step(5)).code).toBe('TIME_LIMIT')
  })

  it('kills a catastrophic regular expression at the slice', () => {
    const execution = run("export async function main() { return /^(a+)+$/.test('a'.repeat(60) + 'b') }")

    expect(failureOf(execution.step(5)).code).toBe('TIME_LIMIT')
  })

  it('is not held up by a flood of promises that never lets the microtask queue rest', () => {
    const execution = run(
      'export async function main() { const spin = () => Promise.resolve().then(spin); spin(); spin(); await new Promise(() => {}) }'
    )
    const startedAt = performance.now()

    const outcome = execution.step(5)

    expect(performance.now() - startedAt).toBeLessThan(1500)
    expect(['failed', 'waiting']).toContain(outcome.status)
  })

  it('kills a string, a typed array and a recursion bomb at the heap and stack limits', () => {
    const bombs = [
      "export async function main() { return 'x'.repeat(2 ** 29).length }",
      'export async function main() { return new Uint8Array(2 ** 30).length }',
      'export async function main() { let s = "x"; for (;;) s += s }',
      'export async function main() { const o = {}; let c = o; for (;;) c = c.next = {} }'
    ]

    for (const source of bombs) {
      expect(['MEMORY_LIMIT', 'TIME_LIMIT', 'SCRIPT_ERROR']).toContain(failureOf(run(source).step(100)).code)
    }
  })

  it('stops a memory bomb quickly, and the next execution on the same runtime is unharmed', () => {
    const bomb = run('export async function main() { const a = []; for (;;) a.push(new Array(1e4).fill(1)) }')
    const startedAt = performance.now()

    const failure = failureOf(bomb.step(5))
    const stalled = performance.now() - startedAt
    const next = run('export async function main() { return 1 + 1 }')

    expect(['MEMORY_LIMIT', 'TIME_LIMIT']).toContain(failure.code)
    // The slice is 5 ms; the garbage collector may stretch it, but not by whole seconds (plan 5.7 measures this)
    expect(stalled).toBeLessThan(1500)
    expect(valueOf(next.step(50))).toBe(2)
  })

  it('does not let a script settle its own calls or see the calls of others', () => {
    const execution = run('export async function main(bot) { const r = await bot.scan(); return r }')
    execution.step(50)
    const [call] = execution.takeCalls()

    execution.resolveCall(call.callId + 100, 'forged')
    expect(execution.step(50)).toEqual({ status: 'waiting' })
    execution.resolveCall(call.callId, 'real')

    expect(valueOf(execution.step(50))).toBe('real')
  })
})
