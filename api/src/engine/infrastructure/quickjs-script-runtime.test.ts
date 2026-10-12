import { JsonValue } from '../domain/json-value'
import { ScriptExecution, ScriptExecutionOptions, StepOutcome } from '../application/script-runtime'
import { QuickJsScriptRuntime } from './quickjs-script-runtime'

describe('QuickJsScriptRuntime', () => {
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
      limits: { memoryBytes: 4 * 1024 * 1024, stackBytes: 256 * 1024 },
      ...overrides
    })
    executions.push(execution)
    return execution
  }

  const finishedValue = (outcome: StepOutcome): JsonValue | undefined => {
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

  it('calls main with the bot object and the arguments', () => {
    const execution = run('export async function main(bot, a, b) { return [bot.id, a + b] }', { args: [1, 2] })
    expect(finishedValue(execution.step(50))).toEqual(['bot-1', 3])
  })

  it('accepts a synchronous main', () => {
    expect(finishedValue(run('export function main() { return 7 }').step(50))).toBe(7)
  })

  it('finishes with undefined when main returns nothing', () => {
    expect(finishedValue(run('export async function main() {}').step(50))).toBeUndefined()
  })

  it('records a game call and resumes the script when the call is resolved', () => {
    const execution = run('export async function main(bot) { const r = await bot.scan(2, "x"); return r.cells }')
    expect(execution.step(50)).toEqual({ status: 'waiting' })
    const [call] = execution.takeCalls()
    expect(call).toEqual({ callId: 1, fn: 'scan', args: [2, 'x'] })
    expect(execution.takeCalls()).toEqual([])
    execution.resolveCall(call.callId, { ok: true, cells: 5 })
    expect(execution.hasReadyWork()).toBe(true)
    expect(finishedValue(execution.step(50))).toBe(5)
  })

  it('exposes each function as a global as well as a method', () => {
    const execution = run('export async function main() { await scan(); return 1 }')
    execution.step(50)
    expect(execution.takeCalls()[0].fn).toBe('scan')
  })

  it('resolves a call without data to undefined', () => {
    const execution = run('export async function main(bot) { const r = await sleep(10); return r === undefined }')
    execution.step(50)
    execution.resolveCall(execution.takeCalls()[0].callId, undefined)
    expect(finishedValue(execution.step(50))).toBe(true)
  })

  it('rejects a call as misuse and ends the execution when the script does not catch it', () => {
    const execution = run('export async function main(bot) { await bot.scan() }')
    execution.step(50)
    execution.rejectCall(execution.takeCalls()[0].callId, 'bad arguments')
    expect(failureOf(execution.step(50))).toEqual({ code: 'SCRIPT_ERROR', message: 'Error: bad arguments' })
  })

  it('lets a script catch a rejected call', () => {
    const execution = run('export async function main(bot) { try { await bot.scan() } catch (e) { return e.message } }')
    execution.step(50)
    execution.rejectCall(execution.takeCalls()[0].callId, 'nope')
    expect(finishedValue(execution.step(50))).toBe('nope')
  })

  it('ignores a settle for an unknown call', () => {
    const execution = run('export async function main() { return 1 }')
    execution.resolveCall(99, 1)
    execution.rejectCall(99, 'x')
    expect(finishedValue(execution.step(50))).toBe(1)
  })

  it('only offers the functions the bot has modules for', () => {
    const execution = run('export async function main(bot) { return [typeof bot.scan, typeof bot.move, typeof move] }')
    expect(finishedValue(execution.step(50))).toEqual(['function', 'undefined', 'undefined'])
  })

  it('collects log lines through the host and keeps the bot object frozen', () => {
    const execution = run(
      'export async function main(bot) { bot.log("hi", 2); log({ a: 1 }); try { bot.id = "other" } catch (e) {} return bot.id }'
    )
    expect(finishedValue(execution.step(50))).toBe('bot-1')
    expect(logs).toEqual([['hi', 2], [{ a: 1 }]])
  })

  it('replaces the clock and Math.random with the host values', () => {
    const execution = run('export async function main(bot) { return [Math.random(), bot.time(), typeof Date] }')
    expect(finishedValue(execution.step(50))).toEqual([0.25, 1234, 'undefined'])
  })

  it('has no way to reach the host', () => {
    const source = `export async function main() {
      const probes = [
        () => typeof process, () => typeof require, () => typeof fetch, () => typeof globalThis.global,
        () => typeof setTimeout, () => typeof XMLHttpRequest, () => typeof WebAssembly, () => typeof std, () => typeof os,
        () => this === undefined, () => typeof __call
      ]
      return probes.map((probe) => probe())
    }`
    expect(finishedValue(run(source).step(50))).toEqual([
      'undefined',
      'undefined',
      'undefined',
      'undefined',
      'undefined',
      'undefined',
      'undefined',
      'undefined',
      'undefined',
      true,
      'undefined'
    ])
  })

  it('cannot escape through the constructor chain', () => {
    const source = `export async function main(bot) {
      const results = []
      for (const get of [
        () => bot.log.constructor.constructor('return process')(),
        () => (async () => {}).constructor('return require("fs")')(),
        () => Function('return globalThis.process.env')()
      ]) {
        try { await get(); results.push('escaped') } catch (e) { results.push(e.name) }
      }
      return results
    }`
    expect(finishedValue(run(source).step(50))).toEqual(['ReferenceError', 'ReferenceError', 'TypeError'])
  })

  it('kills an infinite loop at the slice, even when the script catches errors', () => {
    const execution = run('export async function main() { while (true) { try { for (;;) {} } catch (e) {} } }')
    expect(failureOf(execution.step(5)).code).toBe('TIME_LIMIT')
  })

  it('kills an infinite loop that started after an await', () => {
    const execution = run('export async function main(bot) { await bot.scan(); for (;;) {} }')
    execution.step(5)
    execution.resolveCall(execution.takeCalls()[0].callId, 1)
    expect(failureOf(execution.step(5)).code).toBe('TIME_LIMIT')
  })

  it('kills a single huge allocation at the heap limit', () => {
    const execution = run('export async function main() { return new Array(1e6).fill(1).length }')
    expect(failureOf(execution.step(2000)).code).toBe('MEMORY_LIMIT')
  })

  it('kills a growing memory bomb, by the heap limit or by the slice, whichever comes first', () => {
    const execution = run('export async function main() { const a = []; for (;;) a.push(new Array(10000).fill(1)) }')
    expect(['MEMORY_LIMIT', 'TIME_LIMIT']).toContain(failureOf(execution.step(5)).code)
  })

  it('survives a stack overflow as an ordinary error', () => {
    const execution = run('export async function main() { const f = () => f() + 1; return f() }')
    const failure = failureOf(execution.step(2000))
    expect(failure.code).toBe('SCRIPT_ERROR')
    expect(failure.message).toMatch(/stack/i)
  })

  it('reports a script that throws', () => {
    const execution = run('export async function main() { throw new TypeError("boom") }')
    expect(failureOf(execution.step(50))).toEqual({ code: 'SCRIPT_ERROR', message: 'TypeError: boom' })
  })

  it('reports a synchronous throw of main and a thrown non-error value', () => {
    expect(failureOf(run('export function main() { throw new Error("sync") }').step(50)).message).toBe('Error: sync')
    expect(failureOf(run('export function main() { throw "text" }').step(50)).message).toBe('Error: text')
  })

  it('reports thrown values that are not errors', () => {
    expect(failureOf(run('export function main() { throw { a: 1 } }').step(50)).message).toBe('Error: {"a":1}')
    expect(failureOf(run('export function main() { throw 5 }').step(50)).message).toBe('Error: 5')
  })

  it('kills a script whose runaway code runs in a continuation other than main', () => {
    const execution = run(
      'export async function main(bot) { Promise.resolve().then(() => { for (;;) {} }); await bot.scan() }'
    )
    expect(failureOf(execution.step(5)).code).toBe('TIME_LIMIT')
  })

  it('reports a syntax error', () => {
    expect(failureOf(run('export async function main( {').step(50)).code).toBe('SYNTAX_ERROR')
  })

  it('reports a throw at the top level of the file', () => {
    const failure = failureOf(run('throw new Error("top")').step(50))
    expect(failure).toEqual({ code: 'SCRIPT_ERROR', message: 'Error: top' })
  })

  it('requires a main function', () => {
    expect(failureOf(run('export const main = 1').step(50)).code).toBe('NO_MAIN')
    expect(failureOf(run('export function other() {}').step(50)).code).toBe('NO_MAIN')
  })

  it('keeps the outcome once an execution ended', () => {
    const execution = run('export async function main() { return 1 }')
    const first = execution.step(50)
    expect(execution.step(50)).toBe(first)
  })

  it('reports the memory in use and can be disposed twice', () => {
    const execution = run('export async function main() { return 1 }')
    expect(execution.memoryBytes()).toBeGreaterThan(0)
    execution.dispose()
    execution.dispose()
  })

  it('does not run an execution while it waits on a call', () => {
    const execution = run('export async function main(bot) { await bot.scan(); return 1 }')
    execution.step(50)
    expect(execution.hasReadyWork()).toBe(false)
    expect(execution.step(50)).toEqual({ status: 'waiting' })
  })

  it('stops with the unresolved calls left behind when disposed while waiting', () => {
    const execution = run('export async function main(bot) { await bot.scan() }')
    execution.step(50)
    expect(() => execution.dispose()).not.toThrow()
  })

  describe('imports', () => {
    const modules = new Map([
      [
        '/m/main.js',
        "import { double } from './lib/math'\nimport data from './data.json'\nexport async function main() { return double(data.n) }"
      ],
      ['/m/lib/math.js', 'export const double = (n) => n * 2'],
      ['/m/data.json', 'export default {"n": 21}']
    ])

    it('serves the files of the module map, with or without extension', () => {
      const execution = run(modules.get('/m/main.js') as string, { fileName: '/m/main.js', modules })

      expect(finishedValue(execution.step(50))).toBe(42)
    })

    it('fails the script, not the engine, for an import that is not in the map', () => {
      const source = "import { x } from './nothing'\nexport async function main() { return x }"

      const outcome = run(source, { fileName: '/m/main.js', modules: new Map([['/m/main.js', source]]) }).step(50)

      expect(outcome).toMatchObject({ status: 'failed' })
    })

    it('refuses bare names, absolute paths and other drives', () => {
      for (const specifier of ['left-pad', '/other/x.js', '../../x.js']) {
        const source = `import '${specifier}'\nexport async function main() {}`

        const outcome = run(source, { fileName: '/m/main.js', modules: new Map([['/m/main.js', source]]) }).step(50)

        expect(outcome).toMatchObject({ status: 'failed' })
      }
    })

    it('does not let a script import dynamically what the loader did not bring', () => {
      const source = "export async function main() { return await import('./late.js') }"

      const outcome = run(source, { fileName: '/m/main.js', modules: new Map([['/m/main.js', source]]) }).step(50)

      expect(outcome).toMatchObject({ status: 'failed' })
    })
  })
})
