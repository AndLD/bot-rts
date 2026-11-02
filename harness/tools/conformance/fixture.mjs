// The throwaway trees of the conformance suite (design §5): a copy of the framework that holds the adapter under test, and a project bootstrapped
// from that copy. The copy runs its own tools, so an adapter that this copy of the framework does not ship is judged by the tools that would load it.
import { cpSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

export const FRAMEWORK_DIR = resolve(import.meta.dirname, '..', '..')

const dirs = []

/**
 * A new empty folder; `disposeFixtures` removes every one. Its real path: the command line starts only when `argv[1]` is the real path of the
 * script, and the temporary folder of macOS is behind a link.
 */
export function tempDir(prefix) {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), prefix)))
  dirs.push(dir)
  return dir
}

export function disposeFixtures() {
  dirs.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true }))
}

/** A copy of this framework in which `adapters/<axis>/<name>` is the adapter folder `dir` (it replaces a preset of that name). */
export function frameworkWith({ axis, name, dir }) {
  const copy = tempDir('conformance-framework-')
  cpSync(FRAMEWORK_DIR, copy, { recursive: true, filter: (path) => !path.split('/').includes('.git') })
  const target = join(copy, 'adapters', axis, name)
  rmSync(target, { recursive: true, force: true })
  cpSync(dir, target, { recursive: true })
  return copy
}

// The bootstrap commits, so it needs an identity and none of the machine's own Git configuration (a signing rule, a global hooks path)
function gitEnv() {
  const config = join(tempDir('conformance-gitconfig-'), 'gitconfig')
  writeFileSync(config, '')
  return {
    ...process.env,
    GIT_AUTHOR_NAME: 'conformance',
    GIT_AUTHOR_EMAIL: 'conformance@example.com',
    GIT_COMMITTER_NAME: 'conformance',
    GIT_COMMITTER_EMAIL: 'conformance@example.com',
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: config
  }
}

/**
 * A project bootstrapped by `harness init` of `framework` with the given adapters; the exit code is that of `harness check all` on the result.
 * @param {{ framework: string, stacks: string[], runtimes: string[], host: string }} options
 * @returns {{ root: string, env: object, code: number | null, output: string }}
 */
export function bootstrapProject({ framework, stacks, runtimes, host }) {
  const root = tempDir('conformance-project-')
  const env = gitEnv()
  const args = [
    join(framework, 'tools', 'harness.mjs'),
    'init',
    '--non-interactive',
    '--name',
    'conformance',
    '--repository',
    'acme/conformance',
    '--stack',
    stacks.join(','),
    '--runtime',
    runtimes.join(','),
    '--host',
    host,
    '--from',
    framework,
    '--root',
    root
  ]
  const result = spawnSync(process.execPath, args, { env, encoding: 'utf8' })
  return { root, env, code: result.status, output: `${result.stdout}${result.stderr}`.trim() }
}
