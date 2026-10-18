import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { MapPointType } from '../../../../lib/utils/interfaces/map'
import { RESOURCE } from '../../../../lib/utils/interfaces/resources'
import { SCRIPT_FUNCTIONS } from '../../../../lib/utils/script-api'
import { driveExample } from '../../../tests/fakes/script-example-runner'
import { JsonValue } from '../domain/json-value'
import { ScriptExecution } from '../application/script-runtime'
import { QuickJsScriptRuntime } from './quickjs-script-runtime'

// The scripts in the game design (§17 scenarios, §18 examples) run in the sandbox of a player's scripts against canned answers
// whose cells have the shape a real `scan()` returns (the scanner handler: x, y, z, type, contentId, resource, seenAt), so a
// script that reads a field a cell does not have, or calls a function that does not exist, cannot stay in the design.

const DESIGN_DIRECTORY = join(__dirname, '../../../../docs/product-knowledge/game-design')
const FILES = ['17-in-game-scenarios.md', '18-example-scripts.md']

// What `scan()` returns for a cell
interface ScannedCell {
  x: number
  y: number
  z: number
  type: MapPointType | null
  contentId: string | null
  resource?: { resource: RESOURCE; amount: number }
  seenAt: number
}

const CELLS: ScannedCell[] = [
  { x: 0, y: 0, z: 0, type: null, contentId: null, seenAt: 1 },
  {
    x: 1,
    y: 0,
    z: 0,
    type: MapPointType.RESOURCE,
    contentId: null,
    resource: { resource: RESOURCE.IRON, amount: 80 },
    seenAt: 1
  },
  {
    x: 2,
    y: 0,
    z: 0,
    type: MapPointType.RESOURCE,
    contentId: null,
    resource: { resource: RESOURCE.GOLD, amount: 40 },
    seenAt: 1
  },
  { x: 3, y: 0, z: 0, type: MapPointType.BOT, contentId: 'someone-else', seenAt: 1 }
]

const ANSWERS: Record<string, JsonValue | undefined> = {
  scan: { ok: true, data: CELLS as unknown as JsonValue },
  dig: { ok: true, data: { resource: 'iron', amount: 5 } },
  move: { ok: true, data: { moved: 1 } },
  aim: { ok: true, data: { distance: 2 } },
  shoot: { ok: true, data: { rounds: 1, hits: 1, struck: null } },
  getLocation: { ok: true, data: { x: 3, y: 4, z: 0 } },
  sleep: undefined
}

// The `js` blocks of a design file, with where they are
function examplesIn(file: string): Array<{ name: string; code: string }> {
  const text = readFileSync(join(DESIGN_DIRECTORY, file), 'utf8')

  return [...text.matchAll(/^```js\n([\s\S]*?)^```/gm)].map((match, index) => ({
    name: `${file} block ${index + 1}`,
    code: match[1]
  }))
}

describe('the example scripts of the game design', () => {
  let runtime: QuickJsScriptRuntime
  const executions: ScriptExecution[] = []

  beforeAll(async () => {
    runtime = await QuickJsScriptRuntime.create()
  })
  afterEach(() => executions.splice(0).forEach((execution) => execution.dispose()))

  const examples = FILES.flatMap(examplesIn)

  // Runs a script to its end or its rounds against the canned answers
  function run(code: string) {
    const logs: JsonValue[][] = []
    const execution = runtime.createExecution({
      source: code,
      fileName: 'example.js',
      modules: new Map(),
      args: [],
      identity: { id: 'bot-1' },
      functions: SCRIPT_FUNCTIONS.map((spec) => spec.name),
      host: { random: () => 0.5, time: () => 1000, log: (args) => logs.push(args) },
      limits: { memoryBytes: 8 * 1024 * 1024, stackBytes: 256 * 1024 }
    })
    executions.push(execution)

    return { logs, ...driveExample(execution, ANSWERS) }
  }

  it('are found in the design files', () => {
    expect(examples.length).toBeGreaterThanOrEqual(3)
  })

  it.each(examples.map((example) => [example.name, example] as const))('%s runs in the sandbox', (_name, example) => {
    const { called, logs } = run(example.code)

    expect(called.length + logs.length).toBeGreaterThan(0)
    expect(called.every((fn) => fn in ANSWERS)).toBe(true)
  })

  it('log the gold of the prospector with the coordinates of the real cell', () => {
    const [prospector] = examplesIn('17-in-game-scenarios.md')
    const { status, logs } = run(prospector.code)

    expect(status).toBe('finished')
    expect(logs).toEqual([['Gold found in location [2, 0]']])
  })
})
