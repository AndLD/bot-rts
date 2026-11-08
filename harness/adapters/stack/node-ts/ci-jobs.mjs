// The node-ts stack's CI job layout (design §4.1, role "CI job layout"): the jobs that go between the `changes` job and the aggregator of the host's
// workflow template (adapters/host/*/templates/ci.yml). `static` installs, lints, typechecks and runs the documentation checks; each coverage
// package gets a job that runs its tests with coverage and keeps the raw coverage as `coverage-<package>-1-of-1` for `harness coverage merge`.
// A project that shards its tests, or needs services, writes its own jobs from these.

const NAME = 'node-ts'

const setup = (indent) =>
  [
    '- uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4.4.0',
    '  with:',
    '    fetch-depth: 0',
    '- uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4.4.0',
    '  with:',
    '    node-version-file: .nvmrc',
    '    cache: npm',
    '- run: npm ci'
  ]
    .map((line) => `${indent}${line}`)
    .join('\n')

const job = (id, name, steps) =>
  `  ${id}:\n    name: ${name}\n    needs: changes\n    if: needs.changes.outputs.code == 'true'\n    runs-on: ubuntu-latest\n    steps:\n${steps}\n`

/**
 * The jobs for a profile. A project with several stacks (`stacks` above 1) gets a `static` job per stack, named after it, that runs the stack's own commands
 * (the profile's are the project's, from the first stack's defaults), the documentation check only in the first; and each stack keeps the coverage jobs of the
 * `packages` it owns.
 * @param {object} profile
 * @param {{ stacks?: number, first?: boolean, name?: string, packages?: string[], commands?: object }} [context] what the bootstrap says of the stack among the others
 * @returns {{ ids: string[], yaml: string }} `ids` are the job ids the aggregator needs; `yaml` is the text of the jobs, indented as under `jobs:`
 */
export function ciJobs(profile, { stacks = 1, first = true, name = NAME, packages: owned, commands: own } = {}) {
  const many = stacks > 1
  const commands = many
    ? { lint: own?.lint, typecheck: own?.typecheck, docsCheck: first ? profile.commands?.docsCheck : undefined }
    : (profile.commands ?? {})
  const staticSteps = [
    ...(commands.lint ? [`- run: ${commands.lint}`] : []),
    ...(commands.typecheck ? [`- run: ${commands.typecheck}`] : []),
    ...(commands.docsCheck ? [`- run: ${commands.docsCheck}`] : [])
  ]
  const packages = (profile.coveragePackages ?? []).filter((pkg) => !owned || owned.includes(pkg))
  const staticId = many ? `static-${name}` : 'static'
  const jobs = [
    job(
      staticId,
      many ? `static checks (${name})` : 'static checks',
      [setup('      '), ...staticSteps.map((line) => `      ${line}`)].join('\n')
    ),
    ...packages.map((pkg) =>
      job(
        pkg,
        `${pkg} tests`,
        [
          setup('      '),
          `      - name: Run the tests with coverage (the gate is applied to the merged coverage by the aggregator)`,
          `        run: npm run test:coverage -w ${pkg} -- --coverageThreshold='{}'`,
          '      - name: Keep the coverage for the gate',
          '        uses: actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02 # v4.6.2',
          '        with:',
          `          name: coverage-${pkg}-1-of-1`,
          `          path: ${pkg}/coverage/coverage-final.json`
        ].join('\n')
      )
    )
  ]
  return { ids: [staticId, ...packages], yaml: jobs.join('\n') }
}
