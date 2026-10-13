import { DOC_EXAMPLES } from '../../../../lib/utils/doc-examples'
import { scriptFunctionsFor } from '../../../../lib/utils/script-api'
import { JsonValue } from '../domain/json-value'
import { ScriptExecution } from '../application/script-runtime'
import { QuickJsScriptRuntime } from './quickjs-script-runtime'

// The scripts of the documentation run in the same sandbox as a player's, against canned answers of the game API: they must
// load, call only the functions their modules grant, and not fail. A loop that never ends is stopped after a few rounds.
const ROUNDS = 40

const CELLS = [
  { x: 1, y: 0, z: 0, type: 'resource', contentId: null, resource: 'iron', seenAt: 1 },
  { x: 2, y: 0, z: 0, type: 'bot', contentId: 'someone-else', resource: null, seenAt: 1 }
]

const ANSWERS: Record<string, JsonValue | undefined> = {
  scan: { ok: true, data: CELLS },
  dig: { ok: true, data: { resource: 'iron', amount: 5 } },
  move: { ok: true, data: { moved: 1 } },
  turn: { ok: true, data: { heading: 1 } },
  aim: { ok: true, data: { distance: 2 } },
  shoot: { ok: true, data: { rounds: 1, hits: 1, struck: null } },
  getLocation: { ok: true, data: { x: 3, y: 4, z: 0 } },
  craft: { ok: true, data: [] },
  write: { ok: true, data: null },
  read: { ok: true, data: 'written' },
  sleep: undefined
}

function drive(execution: ScriptExecution): { status: string; called: string[] } {
  const called: string[] = []
  let status = 'waiting'

  for (let round = 0; round < ROUNDS && status === 'waiting'; round++) {
    const outcome = execution.step(50)
    status = outcome.status
    if (outcome.status === 'failed') {
      throw new Error(`${outcome.failure.code}: ${outcome.failure.message}`)
    }
    for (const call of execution.takeCalls()) {
      called.push(call.fn)
      execution.resolveCall(call.callId, ANSWERS[call.fn])
    }
  }

  return { status, called }
}

describe('the example scripts of the documentation', () => {
  let runtime: QuickJsScriptRuntime
  const executions: ScriptExecution[] = []

  beforeAll(async () => {
    runtime = await QuickJsScriptRuntime.create()
  })
  afterEach(() => executions.splice(0).forEach((execution) => execution.dispose()))

  it('are as many as the gallery says, with distinct ids', () => {
    expect(new Set(DOC_EXAMPLES.map((example) => example.id)).size).toBe(DOC_EXAMPLES.length)
    expect(DOC_EXAMPLES.length).toBeGreaterThanOrEqual(5)
  })

  it.each(DOC_EXAMPLES.map((example) => [example.id, example] as const))('%s runs in the sandbox', (_id, example) => {
    const allowed = scriptFunctionsFor(example.modules)
    const logs: JsonValue[][] = []
    const execution = runtime.createExecution({
      source: example.code,
      fileName: `${example.id}.js`,
      modules: new Map(),
      args: [],
      identity: { id: 'bot-1' },
      functions: allowed,
      host: { random: () => 0.5, time: () => 1000, log: (args) => logs.push(args) },
      limits: { memoryBytes: 8 * 1024 * 1024, stackBytes: 256 * 1024 }
    })
    executions.push(execution)

    const { called } = drive(execution)

    expect(called.length + logs.length).toBeGreaterThan(0)
    expect(called.every((fn) => allowed.includes(fn))).toBe(true)
    expect(called.every((fn) => fn in ANSWERS)).toBe(true)
  })
})
