// The checks every adapter passes, whatever its axis (design §5): the manifest against the contract, the logic modules, the commands, and a project
// bootstrapped with the adapter that passes `harness check all`.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { manifestProblems } from '../lib/adapters.mjs'

// The words of a command that are not the program: variables set before it
const programOf = (command) => command.split(/\s+/).find((word) => !word.includes('='))

const exists = (program) =>
  ['--version', '--help'].some((flag) => spawnSync(program, [flag], { stdio: 'ignore', timeout: 20000 }).status === 0)

export const commonChecks = [
  {
    name: 'the manifest matches the contract of its axis and the folder carries its name',
    run: (context) => {
      assert.equal(context.folderName, context.manifest.name, 'the folder is named as the adapter')
      const problems = manifestProblems({
        axis: context.axis,
        name: context.manifest.name,
        dir: context.dir,
        manifest: context.manifest
      })
      assert.equal(problems.length, 0, problems.join('\n'))
    }
  },
  {
    name: 'the logic roles export functions',
    run: async (context) => {
      const { modules } = await context.adapter()
      const problems = []
      for (const [role, entry] of Object.entries(context.manifest.roles)) {
        if (entry.module && typeof modules[entry.module]?.[entry.export] !== 'function') {
          problems.push(`${role}: ${entry.module} does not export the function ${entry.export}`)
        }
      }
      assert.deepEqual(problems, [])
    }
  },
  {
    name: 'every command of the defaults exists on this machine',
    run: (context) => {
      const commands = Object.entries(context.manifest.defaults?.commands ?? {})
      const missing = [...new Set(commands.map(([, command]) => programOf(command)))].filter(
        (program) => !exists(program)
      )
      assert.deepEqual(
        missing.map((program) => {
          const roles = commands.filter(([, command]) => programOf(command) === program).map(([role]) => role)
          return `${program} (commands.${roles.join(', commands.')}): neither \`${program} --version\` nor \`${program} --help\` exits 0`
        }),
        []
      )
    }
  },
  {
    name: 'conformance.json states the samples of the adapter',
    run: (context) => {
      assert.ok(context.conformance, 'the adapter has no conformance.json (the skeleton of its axis has one to fill)')
      assert.equal(typeof context.conformance, 'object')
    }
  },
  {
    name: 'a project bootstrapped with the adapter passes harness check all',
    run: (context) => {
      const { code, output } = context.project()
      assert.equal(code, 0, `harness init on a fixture project exited ${code}:\n${output}`)
    }
  }
]
