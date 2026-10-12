import { ModuleType } from './interfaces/modules'

// The functions a script can call (design §10.2): data shared by the engine, which enforces it, and the editor typings.
// "No module, no function": a function is granted by the modules listed for it.

export type ScriptArgKind = 'integer' | 'string' | 'direction' | 'stringList' | 'nullableString'

export interface ScriptArgSpec {
  name: string
  kind: ScriptArgKind
  isOptional?: boolean
}

export interface ScriptFunctionSpec {
  name: string
  // Any one of these modules grants the function; an empty list means every bot has it
  modules: readonly ModuleType[]
  args: readonly ScriptArgSpec[]
  // Game-API operations one call uses up (design §12.2.1); the engine's balance config may override it
  ops: number
  // The scheduler itself serves the call instead of a handler (sleep)
  isScheduled?: boolean
}

export const SCRIPT_MAX_STRING_LENGTH = 65536
export const SCRIPT_MAX_LIST_LENGTH = 64

export const SCRIPT_FUNCTIONS: readonly ScriptFunctionSpec[] = [
  { name: 'sleep', modules: [], args: [{ name: 'ms', kind: 'integer' }], ops: 0, isScheduled: true },
  { name: 'scan', modules: ['scanner'], args: [], ops: 1 },
  { name: 'view', modules: ['scanner'], args: [{ name: 'since', kind: 'integer', isOptional: true }], ops: 1 },
  { name: 'move', modules: ['engine', 'movement'], args: [{ name: 'cells', kind: 'integer' }], ops: 1 },
  { name: 'turn', modules: ['engine', 'movement'], args: [{ name: 'direction', kind: 'direction' }], ops: 1 },
  { name: 'dig', modules: ['mining'], args: [], ops: 1 },
  {
    name: 'mine',
    modules: ['mining'],
    args: [
      { name: 'x', kind: 'integer' },
      { name: 'y', kind: 'integer' }
    ],
    ops: 1
  },
  { name: 'pick', modules: ['manipulator'], args: [], ops: 1 },
  { name: 'take', modules: ['manipulator'], args: [{ name: 'itemId', kind: 'string', isOptional: true }], ops: 1 },
  {
    name: 'drop',
    modules: ['manipulator'],
    args: [
      { name: 'x', kind: 'integer', isOptional: true },
      { name: 'y', kind: 'integer', isOptional: true }
    ],
    ops: 1
  },
  {
    name: 'aim',
    modules: ['weapon'],
    args: [
      { name: 'x', kind: 'integer' },
      { name: 'y', kind: 'integer' }
    ],
    ops: 1
  },
  {
    name: 'shoot',
    modules: ['weapon'],
    args: [
      { name: 'x', kind: 'integer' },
      { name: 'y', kind: 'integer' }
    ],
    ops: 1
  },
  { name: 'reload', modules: ['weapon'], args: [], ops: 1 },
  { name: 'enable', modules: ['scanner', 'generator', 'battery'], args: [{ name: 'moduleId', kind: 'string' }], ops: 1 },
  { name: 'disable', modules: ['scanner', 'generator', 'battery'], args: [{ name: 'moduleId', kind: 'string' }], ops: 1 },
  { name: 'getLocation', modules: ['gps'], args: [], ops: 1 },
  {
    name: 'craft',
    modules: ['factory'],
    args: [
      { name: 'module', kind: 'string' },
      { name: 'count', kind: 'integer', isOptional: true }
    ],
    ops: 1
  },
  {
    name: 'assemble',
    modules: ['factory'],
    args: [
      { name: 'label', kind: 'nullableString' },
      { name: 'partIds', kind: 'stringList' }
    ],
    ops: 1
  },
  { name: 'research', modules: ['factory'], args: [{ name: 'module', kind: 'string' }], ops: 1 },
  { name: 'learn', modules: ['factory'], args: [{ name: 'itemId', kind: 'string' }], ops: 1 },
  {
    name: 'repair',
    modules: ['repair'],
    args: [
      { name: 'botId', kind: 'string' },
      { name: 'moduleId', kind: 'string' }
    ],
    ops: 1
  },
  {
    name: 'disassemble',
    modules: ['repair'],
    args: [
      { name: 'botId', kind: 'string' },
      { name: 'moduleId', kind: 'string' }
    ],
    ops: 1
  },
  { name: 'read', modules: ['drive'], args: [{ name: 'path', kind: 'string' }], ops: 1 },
  {
    name: 'write',
    modules: ['drive'],
    args: [
      { name: 'path', kind: 'string' },
      { name: 'content', kind: 'string' }
    ],
    ops: 1
  }
]

const BY_NAME = new Map(SCRIPT_FUNCTIONS.map((spec) => [spec.name, spec]))

export function findScriptFunction(name: string): ScriptFunctionSpec | undefined {
  return BY_NAME.get(name)
}

export function isGranted(spec: ScriptFunctionSpec, moduleTypes: ReadonlySet<ModuleType>): boolean {
  return spec.modules.length === 0 || spec.modules.some((type) => moduleTypes.has(type))
}

// The names a bot with these module types can call
export function scriptFunctionsFor(moduleTypes: Iterable<ModuleType>): string[] {
  const types = new Set(moduleTypes)
  return SCRIPT_FUNCTIONS.filter((spec) => isGranted(spec, types)).map((spec) => spec.name)
}

const isString = (value: unknown): value is string =>
  typeof value === 'string' && value.length <= SCRIPT_MAX_STRING_LENGTH

const CHECKS: Record<ScriptArgKind, (value: unknown) => boolean> = {
  integer: (value) => Number.isSafeInteger(value),
  string: isString,
  nullableString: (value) => value === null || isString(value),
  direction: (value) => value === 'left' || value === 'right',
  stringList: (value) =>
    Array.isArray(value) && value.length <= SCRIPT_MAX_LIST_LENGTH && value.every((entry) => isString(entry))
}

// What is wrong with the arguments of a call, or null when they fit the function
export function validateScriptArgs(spec: ScriptFunctionSpec, args: readonly unknown[]): string | null {
  if (args.length > spec.args.length) {
    return `${spec.name} takes at most ${spec.args.length} arguments`
  }
  for (const [index, arg] of spec.args.entries()) {
    const value = args[index]
    if (value === undefined || (value === null && arg.kind !== 'nullableString')) {
      if (!arg.isOptional) {
        return `${spec.name}: ${arg.name} is required`
      }
    } else if (!CHECKS[arg.kind](value)) {
      return `${spec.name}: ${arg.name} must be ${DESCRIPTIONS[arg.kind]}`
    }
  }
  return null
}

const DESCRIPTIONS: Record<ScriptArgKind, string> = {
  integer: 'an integer',
  string: 'a string',
  nullableString: 'a string or null',
  direction: "'left' or 'right'",
  stringList: `a list of at most ${SCRIPT_MAX_LIST_LENGTH} strings`
}
