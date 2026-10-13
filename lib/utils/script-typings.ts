import { SCRIPT_FUNCTIONS, ScriptArgKind, ScriptFunctionSpec } from './script-api'

// TypeScript declarations of the script API for the editor (design §10.1.1): generated from the same catalog the engine
// enforces, so the typings and the runtime cannot drift apart. Every function is declared as a method of `Bot` and as a global,
// like in the sandbox; which of them a bot really has depends on its modules.

const ARG_TYPES: Record<ScriptArgKind, string> = {
  integer: 'number',
  string: 'string',
  direction: "'left' | 'right'",
  stringList: 'string[]',
  nullableString: 'string | null'
}

export const scriptParameters = (spec: ScriptFunctionSpec) =>
  spec.args.map((arg) => `${arg.name}${arg.isOptional ? '?' : ''}: ${ARG_TYPES[arg.kind]}`).join(', ')

export const scriptReturnType = (spec: ScriptFunctionSpec) => (spec.isScheduled ? 'Promise<void>' : 'Promise<Result<any>>')

export function scriptTypings(): string {
  const methods = SCRIPT_FUNCTIONS.map((spec) => `  ${spec.name}(${scriptParameters(spec)}): ${scriptReturnType(spec)}`)
  const globals = SCRIPT_FUNCTIONS.map(
    (spec) => `declare function ${spec.name}(${scriptParameters(spec)}): ${scriptReturnType(spec)}`
  )
  return [
    '// The result of a game call: expected failures are values, not exceptions',
    'type Result<T = void> = { ok: true; data: T } | { ok: false; code: string; msg: string }',
    '',
    'interface BotModule {',
    '  id: string',
    '  type: string',
    '  name: string',
    '}',
    '',
    'interface Bot {',
    '  readonly id: string',
    '  readonly modules: readonly BotModule[]',
    '  log(...values: unknown[]): void',
    '  // The game time in ms',
    '  time(): number',
    ...methods,
    '}',
    '',
    'declare function log(...values: unknown[]): void',
    'declare function time(): number',
    ...globals,
    ''
  ].join('\n')
}

// One function as the documentation shows it: `move(cells: number): Promise<Result<any>>`
export const scriptSignature = (spec: ScriptFunctionSpec) =>
  `${spec.name}(${scriptParameters(spec)}): ${scriptReturnType(spec)}`
