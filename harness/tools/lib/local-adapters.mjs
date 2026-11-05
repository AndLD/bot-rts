// The adapters of a project's own repository (design §5, task 3.4): a folder `harness-adapters/<axis>/<name>/` that the profile file selects as
// `local:<name>` on the axis where it lists it (`adapters.stacks`, `adapters.runtimes`, `adapters.host`). The folder is the project's, outside `harness/`, so a
// sync, `harness migrate` and `harness check vendored` never touch it, and a rollback restores it with the rest of the files a migration changed. The tools
// load it into the registries of the adapters of the framework (`STACKS`, `ADAPTER_RUNTIMES`, `HOSTS`) under the name `local:<name>`, so every tool that finds an
// adapter by its profile name finds it. The conformance suite judges every local adapter in `harness check all` and in `harness migrate`, so a version that
// changes a contract fails there, with the adapter named, and not at some later step.
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import {
  AXES,
  isLocal,
  listAdapters,
  loadAdapterModules,
  LOCAL_DIR,
  LOCAL_PREFIX,
  manifestProblems
} from './adapters.mjs'
import { generators } from './generators.mjs'
import { HOSTS } from './host.mjs'
import { ADAPTER_RUNTIMES } from './runtimes.mjs'
import { STACKS } from './stacks.mjs'
import { runtimeBlockGenerators } from './runtime-blocks.mjs'
import { skillGenerators } from './skills.mjs'

const NAME = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/

/** The adapter name as the profile file writes it, for the folder name of an adapter of the project. */
export const localId = (name) => `${LOCAL_PREFIX}${name}`

/** The names the profile file gives to adapters: `{ stack: [...], runtime: [...], host: [...] }`, in the order of the file. */
export function profileNames(profile) {
  const adapters = profile.adapters ?? {}
  const name = (entry) => (typeof entry === 'string' ? entry : entry?.adapter)
  return {
    stack: (adapters.stacks ?? []).map(name),
    runtime: (adapters.runtimes ?? []).map(name),
    host: adapters.host ? [adapters.host] : []
  }
}

/** The adapters of the folder `harness-adapters/` of a project: `{ axis, name, id, dir, manifest, base }`; `id` is the name the profile file selects. */
export function listLocalAdapters(root) {
  return listAdapters(join(root, LOCAL_DIR)).map((adapter) => ({
    ...adapter,
    id: localId(adapter.name),
    base: LOCAL_DIR
  }))
}

/**
 * The problems of the local adapters and of their selection: every manifest held to the contract of its axis, and every `local:<name>` the profile file
 * selects must be a valid name with a folder on that axis.
 * @returns {string[]}
 */
export function localAdapterProblems(root, profile) {
  const found = listLocalAdapters(root)
  const problems = found.flatMap((adapter) => manifestProblems(adapter))
  for (const axis of AXES) {
    for (const name of profileNames(profile)[axis].filter(isLocal)) {
      const bare = name.slice(LOCAL_PREFIX.length)
      if (!NAME.test(bare)) {
        problems.push(
          `${name}: a local adapter is named "${LOCAL_PREFIX}<name>", the name lower case words joined by hyphens`
        )
      } else if (!found.some((adapter) => adapter.axis === axis && adapter.name === bare)) {
        problems.push(
          `${name}: the profile file selects it as a ${axis} adapter, but ${LOCAL_DIR}/${axis}/${bare}/manifest.json does not exist`
        )
      }
    }
  }
  return problems
}

// What the last `registerLocalAdapters` could not load, for the check that reports it
let loadErrors = []
export const localLoadErrors = () => loadErrors

const REGISTRIES = { stack: STACKS, runtime: ADAPTER_RUNTIMES, host: HOSTS }
// The ids of the generators that a local runtime adapter added, by adapter id, so that registering again replaces them
const added = new Map()

/**
 * Loads the adapters of `harness-adapters/` of a project into the registries under `local:<name>`, and adds the generators of the runtime adapters
 * among them to the managed files. An adapter whose module cannot be loaded is left out and named in the result, so that the checks report it and the
 * commands that do not need it still run. Registering again replaces what an earlier call added.
 * @returns {Promise<{ loaded: string[], errors: string[] }>}
 */
export async function registerLocalAdapters(root) {
  const loaded = []
  const errors = []
  loadErrors = errors
  if (!existsSync(join(root, LOCAL_DIR))) {
    return { loaded, errors }
  }
  let listed
  try {
    listed = listLocalAdapters(root)
  } catch (error) {
    return { loaded, errors: [`${LOCAL_DIR}/: ${error.message}`] }
  }
  for (const axis of AXES) {
    for (const adapter of listed.filter((item) => item.axis === axis)) {
      try {
        const [one] = Object.values(await loadAdapterModules(axis, join(root, LOCAL_DIR), adapter.name))
        REGISTRIES[axis][adapter.id] = one
        loaded.push(adapter.id)
        if (axis === 'runtime') {
          const runtimes = { [adapter.id]: one }
          const ids = new Set(added.get(adapter.id) ?? [])
          for (let index = generators.length - 1; index >= 0; index -= 1) {
            if (ids.has(generators[index].id)) generators.splice(index, 1)
          }
          const fresh = [...skillGenerators(runtimes), ...runtimeBlockGenerators(runtimes)]
          generators.push(...fresh)
          added.set(
            adapter.id,
            fresh.map(({ id }) => id)
          )
        }
      } catch (error) {
        errors.push(`${LOCAL_DIR}/${axis}/${adapter.name}: ${error.message.split('\n')[0]}`)
      }
    }
  }
  return { loaded, errors }
}

/**
 * Runs the conformance suite on every local adapter of a project, each in a process of its own, and returns the problems: one line per adapter that fails,
 * naming the checks that failed. `harness check all` runs it; with no `harness-adapters/` it does nothing.
 * @returns {{ problems: string[], count: number }}
 */
export function localSuiteProblems(
  root,
  { harness = join(import.meta.dirname, '..', 'harness.mjs'), run = spawnSync } = {}
) {
  const problems = []
  const adapters = listLocalAdapters(root)
  for (const adapter of adapters) {
    const result = run(process.execPath, [harness, 'adapter', 'test', adapter.dir], { encoding: 'utf8' })
    if (result.status !== 0) {
      problems.push(...failureLines(adapter, `${result.stdout ?? ''}${result.stderr ?? ''}`))
    }
  }
  return { problems, count: adapters.length }
}

// The lines of `harness adapter test` that name the failed checks, as problems of the adapter: the check and what it says (its first lines)
function failureLines(adapter, output) {
  const lines = output.split('\n')
  const failed = lines.flatMap((line, index) => {
    if (!line.startsWith('FAIL ')) {
      return []
    }
    const detail = []
    for (let next = index + 1; lines[next]?.startsWith('       ') && detail.length < 4; next += 1) {
      detail.push(lines[next].trim())
    }
    return [[line.slice(5), ...detail].join('\n    ')]
  })
  const where = `${LOCAL_DIR}/${adapter.axis}/${adapter.name}`
  return failed.length
    ? failed.map((check) => `${where}: fails the conformance suite of the ${adapter.axis} contract: ${check}`)
    : [`${where}: the conformance suite could not run: ${output.trim().split('\n').at(-1) || 'no output'}`]
}
