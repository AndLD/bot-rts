// The checks of a stack adapter (design §4.1, §5): what its logic roles do on samples that its `conformance.json` names. The local gate is
// judged through the framework's gate driver, so the plan is held to what the driver does with it.
//
// conformance.json of a stack adapter:
//   sourceFile        a source file of a package, relative to the package (`src/main.ts`)
//   format.handled    files the formatter formats, relative to the project (`src/main.ts`, `README.md`)
//   format.ignored    files it leaves alone (`logo.png`)
//   coverage.shards   the raw coverage of two or more shards of one package, relative to the adapter (for the coverage-merge role)
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { isAbsolute, join } from 'node:path'
import { changedFileFailures } from '../lib/coverage.mjs'
import { planPush } from '../lib/gate.mjs'
import { Skip } from './skip.mjs'

const PACKAGES = ['api', 'web']
// The metrics a neutral coverage summary may report (design §4.1): a stack may measure a subset
const METRICS = ['statements', 'branches', 'functions', 'lines']
// Programs that fetch what they run, and the form of `npx` that does not
const DOWNLOADERS = new Set(['pnpx', 'bunx', 'uvx', 'pipx'])

const mentions = (value, word) => new RegExp(`(^|[^\\w-])${word}([^\\w-]|$)`).test(JSON.stringify(value))

function sample(context, key) {
  const value = key.split('.').reduce((object, part) => object?.[part], context.conformance)
  assert.ok(value, `conformance.json has no "${key}"`)
  return value
}

// The profile of the fixture project, with the stacks and the packages of the check
const profileFor = (context, stacks) => ({
  ...context.profile(),
  adapters: { ...context.profile().adapters, stacks },
  coveragePackages: PACKAGES,
  gate: {}
})

async function plan(context, files, { stacks, extra = {} } = {}) {
  const adapter = await context.adapter()
  const profile = profileFor(context, stacks ?? [{ adapter: context.name, packages: PACKAGES }])
  return planPush(files, { profile, stacks: { [context.name]: adapter, ...extra }, exists: () => true })
}

const isCoverageCheck = (step) =>
  step.command === 'harness' && step.args.slice(0, 2).join(' ') === 'coverage check-changed'

export const stackChecks = [
  {
    name: 'gate plan: a push of only Markdown runs no code check',
    run: async (context) => {
      const { steps, skip } = await plan(context, ['README.md', 'docs/guide.md'])
      assert.equal(skip, null)
      assert.deepEqual(
        steps.filter((step) => step.command !== 'harness'),
        [],
        'the stack must not plan a step for documentation'
      )
    }
  },
  {
    name: 'gate plan: a source file runs the tests of its package and holds the changed file to the coverage gate',
    run: async (context) => {
      const { steps } = await plan(context, [`api/${sample(context, 'sourceFile')}`])
      assert.ok(
        steps.some((step) => /test/i.test(step.label)),
        `no step runs the tests: ${steps.map((step) => step.label).join(', ') || 'no steps'}`
      )
      assert.ok(
        steps.some(isCoverageCheck),
        'no step holds the changed files to the gate (`harness coverage check-changed <base> <packages>`)'
      )
      for (const step of steps) {
        assert.ok(
          step.label && step.command && Array.isArray(step.args),
          `a step is { label, command, args }: ${JSON.stringify(step)}`
        )
      }
    }
  },
  {
    name: 'gate plan: a file of one package leaves the other packages alone',
    run: async (context) => {
      const { steps } = await plan(context, [`api/${sample(context, 'sourceFile')}`])
      assert.ok(steps.length > 0)
      assert.equal(mentions(steps, 'web'), false, `a step names the package web: ${JSON.stringify(steps)}`)
    }
  },
  {
    name: 'gate plan: with a second stack each file goes to its own stack',
    run: async (context) => {
      const seen = []
      const other = {
        manifest: { roles: { 'local-gate-plan': { module: 'gate.mjs', export: 'plan' } } },
        modules: {
          'gate.mjs': {
            plan: ({ files }) => {
              seen.push(files)
              return { steps: [{ label: 'the other stack', command: 'other', args: [] }], coveragePackages: [] }
            }
          }
        }
      }
      const { steps } = await plan(context, [`api/${sample(context, 'sourceFile')}`, 'web/data.txt'], {
        stacks: [
          { adapter: context.name, packages: ['api'] },
          { adapter: 'conformance-other', packages: ['web'] }
        ],
        extra: { 'conformance-other': other }
      })
      assert.deepEqual(seen, [['web/data.txt']], 'the other stack plans only the file of its package')
      const own = steps.filter((step) => step.label !== 'the other stack' && step.command !== 'harness')
      assert.ok(own.length > 0, 'the adapter plans the file of its package')
      assert.equal(
        mentions(own, 'web'),
        false,
        `a step of the adapter names the other stack's package: ${JSON.stringify(own)}`
      )
    }
  },
  {
    name: 'formatter: formats the declared file types, leaves the others, and never downloads a formatter',
    run: async (context) => {
      const { modules } = await context.adapter()
      const entry = context.manifest.roles.formatter
      if (!entry?.module) {
        throw new Skip('the formatter role has no module')
      }
      const { formatCommand } = modules[entry.module]
      for (const path of sample(context, 'format.handled')) {
        const result = formatCommand({ path })
        assert.ok(result, `${path} is not formatted`)
        assert.equal(typeof result.command, 'string')
        assert.ok(
          Array.isArray(result.args) && result.args.includes(path),
          `the command for ${path} does not name the file`
        )
        const downloads =
          DOWNLOADERS.has(result.command) ||
          result.args.includes('dlx') ||
          (result.command === 'npx' && !result.args.includes('--no-install') && !result.args.includes('--offline'))
        assert.equal(
          downloads,
          false,
          `${result.command} ${result.args.join(' ')} may download a formatter; run it from the project's installation`
        )
      }
      for (const path of sample(context, 'format.ignored')) {
        assert.equal(formatCommand({ path }), null, `${path} is formatted, but the adapter does not handle its type`)
      }
    }
  },
  {
    name: 'coverage-merge: shards become a neutral summary that the coverage gate reads',
    run: async (context) => {
      const { modules } = await context.adapter()
      const entry = context.manifest.roles['coverage-merge']
      if (!entry) {
        throw new Skip('the coverage-merge role is empty (the stack does not shard its tests)')
      }
      const module = modules[entry.module]
      assert.equal(
        typeof module.SHARD_FILE,
        'string',
        `${entry.module} exports SHARD_FILE, the name of the raw coverage file of a shard`
      )
      const shards = sample(context, 'coverage.shards').map((file) =>
        JSON.parse(readFileSync(join(context.dir, file), 'utf8'))
      )
      const { artifacts, summary } = module[entry.export](shards)

      assert.ok(artifacts?.[module.SHARD_FILE], `the merge writes the merged ${module.SHARD_FILE}`)
      const files = Object.keys(summary).filter((key) => key !== 'total')
      assert.ok(summary.total && files.length > 0, 'the summary has a total and an entry per file')
      assert.ok(
        files.every((file) => isAbsolute(file)),
        'the entries of the summary are keyed by absolute path'
      )
      const measured = Object.keys(summary.total)
      assert.ok(
        measured.length > 0 && measured.every((metric) => METRICS.includes(metric)),
        `metrics are some of ${METRICS.join(', ')}: ${measured}`
      )
      for (const entry of Object.values(summary)) {
        for (const metric of measured) {
          const { total, covered, pct } = entry[metric] ?? {}
          assert.ok([total, covered, pct].every(Number.isFinite), `${metric} has total, covered and pct`)
        }
      }

      // The gate reads the summary: every file is below an impossible gate, and none below a gate of zero
      const root = '/'
      const changed = files.map((file) => file.slice(1))
      const [pkg] = changed[0].split('/')
      const gate = (value) => Object.fromEntries(measured.map((metric) => [metric, value]))
      const run = (value) => changedFileFailures({ summary, root, changed, pkg, gate: gate(value) })
      assert.equal(run(0).failures.length, 0)
      assert.equal(run(101).failures.length, changed.filter((file) => file.startsWith(`${pkg}/`)).length)
    }
  },
  {
    name: 'CI job layout: jobs that depend on the change detection, one coverage job per package that keeps its coverage',
    run: async (context) => {
      const { modules } = await context.adapter()
      const entry = context.manifest.roles['ci-job-layout']
      const { ids, yaml } = modules[entry.module][entry.export](
        profileFor(context, [{ adapter: context.name, packages: PACKAGES }])
      )
      assert.ok(Array.isArray(ids) && ids.length > 0 && typeof yaml === 'string')
      for (const id of ids) {
        assert.match(yaml, new RegExp(`^ {2}${id}:`, 'm'), `the job ${id} is not a key of the jobs`)
      }
      assert.ok(
        (yaml.match(/needs: changes/g) ?? []).length >= ids.length,
        'every job needs `changes`, the detection of a documentation-only change'
      )
      for (const pkg of PACKAGES) {
        assert.match(
          yaml,
          new RegExp(`coverage-${pkg}-1-of-1`),
          `no job keeps the coverage of ${pkg} as the artifact coverage-${pkg}-1-of-1`
        )
      }
    }
  },
  {
    name: 'scaffold files: relative paths outside the vendored framework, and the ignore files exclude it',
    run: async (context) => {
      const { modules } = await context.adapter()
      const entry = context.manifest.roles['scaffold-files']
      if (!entry) {
        throw new Skip('the scaffold-files role is empty')
      }
      const files = modules[entry.module][entry.export](
        profileFor(context, [{ adapter: context.name, packages: PACKAGES }])
      )
      assert.ok(Array.isArray(files) && files.length > 0)
      for (const file of files) {
        assert.ok(
          typeof file.path === 'string' && !isAbsolute(file.path) && !file.path.split('/').includes('..'),
          `${file.path} is not a path inside the project`
        )
        assert.ok(typeof file.content === 'string' || Array.isArray(file.lines), `${file.path} has content or lines`)
        assert.ok(!file.path.startsWith('harness/'), `${file.path} is inside the vendored framework`)
      }
      const textOf = (path) => {
        const file = files.find((item) => item.path === path)
        return file && (file.content ?? file.lines.join('\n'))
      }
      for (const { path, optional } of context.manifest.roles['ignore-files']?.files ?? []) {
        const text = textOf(path)
        if (text === undefined && optional) {
          continue
        }
        assert.ok(text !== undefined, `the ignore file ${path} is not written by the scaffold`)
        assert.match(text, /^harness\/?$/m, `${path} does not exclude the vendored framework (a line \`harness/\`)`)
      }
    }
  }
]
