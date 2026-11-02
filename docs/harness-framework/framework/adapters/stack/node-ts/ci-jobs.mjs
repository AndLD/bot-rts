// The node-ts stack's CI job layout (design §4.1, role "CI job layout"): the jobs that go between the `changes` job and the aggregator of the host's
// workflow template (adapters/host/*/templates/ci.yml). `static` installs, lints, typechecks and runs the documentation checks; each coverage
// package gets a job that runs its tests with coverage and keeps the raw coverage as `coverage-<package>-1-of-1` for `harness coverage merge`.
// A project that shards its tests, or needs services, writes its own jobs from these.

const setup = (indent) =>
  [
    '- uses: actions/checkout@v4',
    '  with:',
    '    fetch-depth: 0',
    '- uses: actions/setup-node@v4',
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
 * The jobs for a profile.
 * @returns {{ ids: string[], yaml: string }} `ids` are the job ids the aggregator needs; `yaml` is the text of the jobs, indented as under `jobs:`
 */
export function ciJobs(profile) {
  const commands = profile.commands ?? {}
  const staticSteps = [
    ...(commands.lint ? [`- run: ${commands.lint}`] : []),
    ...(commands.typecheck ? [`- run: ${commands.typecheck}`] : []),
    ...(commands.docsCheck ? [`- run: ${commands.docsCheck}`] : [])
  ]
  const packages = profile.coveragePackages ?? []
  const jobs = [
    job('static', 'static checks', [setup('      '), ...staticSteps.map((line) => `      ${line}`)].join('\n')),
    ...packages.map((pkg) =>
      job(
        pkg,
        `${pkg} tests`,
        [
          setup('      '),
          `      - name: Run the tests with coverage (the gate is applied to the merged coverage by the aggregator)`,
          `        run: npm run test:coverage -w ${pkg} -- --coverageThreshold='{}'`,
          '      - name: Keep the coverage for the gate',
          '        uses: actions/upload-artifact@v4',
          '        with:',
          `          name: coverage-${pkg}-1-of-1`,
          `          path: ${pkg}/coverage/coverage-final.json`
        ].join('\n')
      )
    )
  ]
  return { ids: ['static', ...packages], yaml: jobs.join('\n') }
}
