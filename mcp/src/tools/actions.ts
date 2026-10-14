import { z, ZodTypeAny } from 'zod'
import { categoryOfFunction } from '../../../lib/utils/interfaces/settings'
import { ScriptArgSpec, SCRIPT_FUNCTIONS, ScriptFunctionSpec } from '../../../lib/utils/script-api'
import { botId, defineTool, ToolDefinition } from './types'

// The functions of the script API that have a tool of their own elsewhere (fabrication, maintenance, files) or that make no sense
// by hand (`sleep`)
const ELSEWHERE = new Set(['sleep', 'craft', 'assemble', 'research', 'learn', 'repair', 'disassemble', 'read', 'write'])

const KIND_SCHEMAS: Record<ScriptArgSpec['kind'], () => ZodTypeAny> = {
  integer: () => z.number().int(),
  string: () => z.string(),
  direction: () => z.enum(['left', 'right']),
  stringList: () => z.array(z.string()),
  nullableString: () => z.string().nullable()
}

const snakeCase = (name: string) => name.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)

// Exported for the tests: a tool for one function of the script API
export function toolOf(spec: ScriptFunctionSpec): ToolDefinition {
  const category = categoryOfFunction(spec.name)
  const argNames = spec.args.map((arg) => arg.name)
  const needs = spec.modules.length ? ` Needs one of the modules: ${spec.modules.join(', ')}.` : ''

  return defineTool({
    name: `bot_${snakeCase(spec.name)}`,
    title: `${spec.name} (manual action)`,
    description:
      `Does \`${spec.name}(${argNames.join(', ')})\` of the script API by hand, with the same rules and the same answer: ` +
      `it costs energy and operations, and the category switches apply.${needs}`,
    scope: category ?? 'read',
    isReadOnly: category === null,
    inputSchema: {
      botId,
      ...Object.fromEntries(
        spec.args.map((arg) => [
          arg.name,
          arg.isOptional ? KIND_SCHEMAS[arg.kind]().optional() : KIND_SCHEMAS[arg.kind]()
        ])
      )
    },
    run: (client, input) => {
      const values = input as Record<string, unknown>
      // Optional arguments at the end may be left out
      const args = argNames.map((name) => values[name])
      while (args.length && args[args.length - 1] === undefined) args.pop()

      return client.post(`/bots/${values.botId}/actions`, { fn: spec.name, args })
    }
  })
}

// "Tools mirror the game" (design §22.2): one tool per manual action, made from the same list the engine enforces
export const actionTools: ToolDefinition[] = SCRIPT_FUNCTIONS.filter((spec) => !ELSEWHERE.has(spec.name)).map(toolOf)
