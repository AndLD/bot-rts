import { ModuleType } from '@lib/utils/interfaces/modules'
import { categoryOfFunction, MANUAL_CATEGORIES, ManualCategory } from '@lib/utils/interfaces/settings'
import { isGranted, SCRIPT_FUNCTIONS, ScriptFunctionSpec } from '@lib/utils/script-api'

// What the player typed for each argument of an action, by argument name
export type ActionInputs = Record<string, string>

export type BuiltArgs = { ok: true; args: unknown[] } | { ok: false; arg: string; reason: 'missing' | 'invalid' }

// The arguments of a call from what was typed, as the script API takes them (design §10.2): an optional one that was left
// empty is not passed, and a missing optional one in the middle is passed as null only where the API allows it
export function buildArgs(spec: ScriptFunctionSpec, inputs: ActionInputs): BuiltArgs {
  const args: unknown[] = []

  for (const arg of spec.args) {
    const raw = (inputs[arg.name] ?? '').trim()

    if (raw === '') {
      if (arg.kind === 'nullableString') {
        args.push(null)
      } else if (arg.isOptional) {
        args.push(undefined)
      } else {
        return { ok: false, arg: arg.name, reason: 'missing' }
      }
    } else if (arg.kind === 'integer') {
      const value = Number(raw)
      if (!Number.isSafeInteger(value)) {
        return { ok: false, arg: arg.name, reason: 'invalid' }
      }
      args.push(value)
    } else if (arg.kind === 'stringList') {
      args.push(raw.split(/[\s,]+/).filter(Boolean))
    } else {
      args.push(raw)
    }
  }

  while (args.length && args[args.length - 1] === undefined) {
    args.pop()
  }

  return { ok: true, args }
}

export interface ActionGroup {
  // null for observation, which is always on and has no switch
  category: ManualCategory | null
  actions: ScriptFunctionSpec[]
}

// The actions a bot with these modules can do by hand, grouped by the category they belong to; observation first, then the
// categories in their order. A category without an action the bot can do is left out.
export function actionGroups(types: ReadonlySet<ModuleType>): ActionGroup[] {
  const granted = SCRIPT_FUNCTIONS.filter((spec) => !spec.isScheduled && isGranted(spec, types))

  return [null, ...MANUAL_CATEGORIES]
    .map((category) => ({ category, actions: granted.filter((spec) => categoryOfFunction(spec.name) === category) }))
    .filter((group) => group.actions.length)
}
