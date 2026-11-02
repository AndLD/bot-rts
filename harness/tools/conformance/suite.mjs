// The conformance suite (design §5), run by `harness adapter test <path>` and, for the presets, by the framework's own tests. An adapter is a folder
// with a `manifest.json`; the suite of its axis holds it to the contract (`core/contracts/<axis>.md`). Each check is `{ name, run(context) }`; it
// passes by returning, fails by throwing (an assertion), and is skipped by throwing `Skip` (a role the contract makes optional and the adapter leaves empty).
import { existsSync, readFileSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import { listAdapters, loadAdapterModules } from '../lib/adapters.mjs'
import { loadProfile } from '../lib/profile.mjs'
import { bootstrapProject, disposeFixtures, frameworkWith } from './fixture.mjs'
import { commonChecks } from './common.mjs'
import { hostChecks } from './host.mjs'
import { runtimeChecks } from './runtime.mjs'
import { Skip } from './skip.mjs'
import { stackChecks } from './stack.mjs'

export const CONFORMANCE_FILE = 'conformance.json'
const CHECKS = { stack: stackChecks, runtime: runtimeChecks, host: hostChecks }
// The adapters that fill the other axes of the fixture project
const OTHERS = { stack: 'node-ts', runtime: 'claude-code', host: 'github' }

/** The context of one run: the adapter, and the trees that checks share, built when a check first needs them. */
function contextFor(dir) {
  const path = resolve(dir)
  const manifestPath = join(path, 'manifest.json')
  if (!existsSync(manifestPath)) {
    throw new Error(`${path} has no manifest.json: an adapter is a folder with a manifest`)
  }
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  const { axis, name } = manifest
  if (!CHECKS[axis]) {
    throw new Error(`${path}: the manifest names the axis "${axis}"; the axes are ${Object.keys(CHECKS).join(', ')}`)
  }
  const conformancePath = join(path, CONFORMANCE_FILE)
  const cache = {}
  const once = (key, make) => (cache[key] ??= make())

  const context = {
    dir: path,
    axis,
    name,
    manifest,
    conformance: existsSync(conformancePath) ? JSON.parse(readFileSync(conformancePath, 'utf8')) : null,
    folderName: basename(path),
    /** A copy of the framework that holds the adapter. */
    framework: () => once('framework', () => frameworkWith({ axis, name: basename(path), dir: path })),
    /** A project bootstrapped from that copy, the other axes filled by the presets. */
    project: () =>
      once('project', () => {
        const pick = (own) => (axis === own ? basename(path) : OTHERS[own])
        return bootstrapProject({
          framework: context.framework(),
          stacks: [pick('stack')],
          runtimes: [pick('runtime')],
          host: pick('host')
        })
      }),
    profile: () => once('profile', () => loadProfile(context.project().root)),
    /** The adapter's modules, loaded from the copy of the framework. */
    adapter: () =>
      once(
        'adapter',
        async () => (await loadAdapterModules(axis, join(context.framework(), 'adapters')))[basename(path)]
      ),
    listed: () => listAdapters(join(context.framework(), 'adapters')).find((item) => item.name === basename(path))
  }
  return context
}

/**
 * Runs the checks that apply to the adapter at `dir`; `only` is a pattern that narrows them by name.
 * @returns {Promise<{ axis: string, name: string, results: { name: string, status: 'pass' | 'fail' | 'skip', message?: string }[] }>}
 */
export async function runSuite({ dir, only }) {
  const context = contextFor(dir)
  const checks = [...commonChecks, ...CHECKS[context.axis]].filter((check) => !only || only.test(check.name))
  const results = []
  try {
    for (const check of checks) {
      try {
        await check.run(context)
        results.push({ name: check.name, status: 'pass' })
      } catch (error) {
        results.push(
          error instanceof Skip
            ? { name: check.name, status: 'skip', message: error.message }
            : { name: check.name, status: 'fail', message: error.message }
        )
      }
    }
  } finally {
    disposeFixtures()
  }
  return { axis: context.axis, name: context.name, results }
}

/** The lines `harness adapter test` prints, and whether the adapter passed. */
export function describeRun({ axis, name, results }) {
  const mark = { pass: 'ok  ', fail: 'FAIL', skip: 'skip' }
  const lines = results.flatMap(({ name: check, status, message }) => [
    `${mark[status]} ${check}`,
    ...(message ? [`       ${message.split('\n').join('\n       ')}`] : [])
  ])
  const failed = results.filter(({ status }) => status === 'fail').length
  lines.push(
    failed
      ? `The ${axis} adapter ${name} fails ${failed} of ${results.length} checks.`
      : `The ${axis} adapter ${name} passes ${results.filter(({ status }) => status === 'pass').length} checks (${results.filter(({ status }) => status === 'skip').length} skipped).`
  )
  return { lines, passed: failed === 0 }
}
