// Writes the data of the player documentation that comes from the code (run: npm run docs:generate -w api): the script API reference
// from the shared function catalog, and the module and recipe catalogue from the balance config, so the numbers in the docs cannot
// drift from the game (design §15.5). CI fails when the committed files differ from what this writes.
import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { format, resolveConfig } from 'prettier'
import { DEFAULT_RESOURCE_BALANCE, RESOURCES } from '../../lib/utils/interfaces/resources'
import { SCRIPT_FUNCTIONS } from '../../lib/utils/script-api'
import { scriptSignature } from '../../lib/utils/script-typings'
import { TERMINAL_COMMANDS } from '../../lib/utils/interfaces/terminal'
import { DEFAULT_CRAFTING_CONFIG } from '../src/crafting/domain/crafting-config'
import { MODULE_CATALOG } from '../src/modules/domain/module-catalog'

// What a module is in the middle of (its charge, its queue), as opposed to what it is: not part of a catalogue of new modules
const RUNTIME_PROPS = new Set(['isConnected', 'isEnabled', 'items', 'jobs', 'loaded', 'material', 'value'])

const stable = (props: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(props).filter(([name]) => !RUNTIME_PROPS.has(name)))

const out = join(__dirname, '..', '..', 'client', 'src', 'docs', 'generated')

// Written the way the repository's formatter writes JSON, so the committed files are what this produces
async function write(name: string, data: unknown) {
  const options = (await resolveConfig(join(out, name))) ?? {}

  writeFileSync(join(out, name), await format(JSON.stringify(data), { ...options, parser: 'json' }))
}

async function main() {
  mkdirSync(out, { recursive: true })

  await write('script-api.json', {
    functions: SCRIPT_FUNCTIONS.map((spec) => ({
      name: spec.name,
      signature: scriptSignature(spec),
      modules: spec.modules,
      args: spec.args.map(({ name, kind, isOptional }) => ({ name, kind, isOptional: isOptional ?? false })),
      ops: spec.ops
    }))
  })

  await write('catalogue.json', {
    resources: RESOURCES.map((resource) => ({ resource, ...DEFAULT_RESOURCE_BALANCE[resource] })),
    modules: MODULE_CATALOG.map(({ name, type, maxCondition, weight, operationCost, idleCost, props }) => ({
      name,
      type,
      maxCondition,
      weight,
      operationCost,
      idleCost,
      props: stable(props)
    })),
    recipes: DEFAULT_CRAFTING_CONFIG.recipes,
    balance: DEFAULT_CRAFTING_CONFIG.balance
  })

  await write('commands.json', { commands: TERMINAL_COMMANDS })
}

main().catch((error) => {
  process.stderr.write(`${error}\n`)
  process.exit(1)
})
