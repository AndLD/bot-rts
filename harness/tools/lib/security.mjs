// `harness check security` (task 2.2): the probes of the security review (`core/reviews/security/probes/`) that a script can decide, run together. Each check names
// the probe it automates, a finding starts with that id, and the result lists the scriptable probes that have no check yet, as the gaps for the next review.
// It reads the tracked files and runs nothing that needs the network, except the audit of the dependencies, which runs only with `--audit`.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ADAPTER_RUNTIMES } from './runtimes.mjs'
import { hostModule } from './host.mjs'
import { inFramework, selectedAdapters } from './lock.mjs'
import { checkBinaries, checkManifests, runAudit } from './security-deps.mjs'
import { checkSecretFiles, readText, scanRange, scanTracked, trackedFiles } from './security-secrets.mjs'

/** The probes with a check, and where each is checked. A probe of the catalogue that is not here and is scriptable is a gap. */
export const AUTOMATED = Object.freeze({
  'S1-001': 'the secret scan of the tracked files, and with `--range` of a history range',
  'S1-002': 'the tracked files that match `access.denyRead`, and the ignore file',
  'S1-010': 'the secret scan, which reads the workflow files',
  'S1-017': 'the secret scan, which reads the files of the agent runtime',
  'S2-001': 'a lock file beside each manifest of the stacks',
  'S2-003': 'the versions in the manifests of the stacks',
  'S2-004': "the host adapter's check of the workflow files",
  'S2-010': 'the dependency audit, with `--audit`',
  'S2-016': 'the scan for binary files',
  'S2-017': 'the check `harness check vendored`',
  'S3-001': "the host adapter's check of the workflow files",
  'S3-005': "the host adapter's check of the workflow files",
  'S4-001': "the runtime adapter's check of the committed settings",
  'S4-018': "the host adapter's check of the workflow files"
})

/** The scriptable probes of the catalogue (the folder of probe files), as `{ id, title }`; empty when the folder is not there. */
export function scriptableProbes(folder) {
  if (!existsSync(folder)) return []
  return readdirSync(folder)
    .filter((name) => /^S\d.*\.md$/.test(name))
    .flatMap((name) => {
      const found = []
      let current = null
      for (const line of readFileSync(join(folder, name), 'utf8').split('\n')) {
        const heading = /^### (S\d+-\d+) — (.*)$/.exec(line)
        if (heading) current = { id: heading[1], title: heading[2] }
        else if (current && line.startsWith('- **Decided by:** scriptable')) found.push(current)
      }
      return found
    })
}

const note = ({ probe, text }) => `${probe} ${text}`

function workflowFiles(root, profile, files) {
  const { isWorkflowFile } = hostModule(profile, 'values-in-host-files')
  return files.filter(isWorkflowFile).flatMap((path) => {
    const text = readText(root, path)
    return text === null ? [] : [{ path, text }]
  })
}

function runtimeAudits({ root, profile, runtimes }) {
  const problems = []
  const names = []
  for (const name of selectedAdapters(profile).runtimes) {
    const entry = runtimes[name]?.manifest.roles['settings-audit']
    if (!entry?.module) continue
    names.push(name)
    problems.push(...runtimes[name].modules[entry.module][entry.export]({ root, profile }))
  }
  return { problems, names }
}

/**
 * @param {{ root: string, profile: object, range?: string, audit?: boolean, runtimes?: object, run?: Function }} options
 *   `range` is a Git range to scan (`<base>..<head>`); `audit` runs the dependency audit; `runtimes` and `run` are seams for tests
 * @returns {{ problems: string[], messages: string[] }}
 */
export function checkSecurity({ root, profile, range, audit = false, runtimes = ADAPTER_RUNTIMES, run }) {
  const files = trackedFiles(root, profile)
  const found = []
  const messages = []

  const secrets = scanTracked({ root, profile, files })
  found.push(...secrets.problems, ...checkSecretFiles({ root, profile, files }))
  messages.push(
    `Scanned ${secrets.read} of ${files.length} tracked files with ${profile.security?.secretPatterns?.length ?? 0} secret rules (S1-001, S1-002, S1-010, S1-017).`
  )

  if (range) {
    const history = scanRange({ root, profile, range })
    found.push(...history.problems)
    messages.push(`Scanned the lines added by ${history.commits} commits of ${range} for secrets.`)
  }

  const manifests = checkManifests({ root, profile, files })
  found.push(...manifests.problems, ...checkBinaries({ root, files }))
  messages.push(
    `Checked ${manifests.manifests} dependency manifests for a lock file and for open versions, and the tracked files for binaries (S2-001, S2-003, S2-016).`
  )

  try {
    const { auditCi } = hostModule(profile, 'ci-audit')
    const workflows = workflowFiles(root, profile, files)
    found.push(...auditCi({ files: workflows }))
    messages.push(`Checked ${workflows.length} workflow files (S2-004, S3-001, S3-005, S4-018).`)
  } catch (error) {
    messages.push(`Not checked: the workflow files (S2-004, S3-001, S3-005, S4-018): ${error.message}.`)
  }

  const settings = runtimeAudits({ root, profile, runtimes })
  found.push(...settings.problems)
  messages.push(
    settings.names.length
      ? `Checked the committed and the local settings of ${settings.names.join(', ')} (S1-015, S4-001, S4-002).`
      : 'Not checked: the settings of the agent runtime (no selected runtime fills the role "settings-audit").'
  )

  if (audit) {
    const result = runAudit({ root, profile, run })
    found.push(...result.problems)
    messages.push(
      `Ran the dependency audit: ${result.commands.join(', ') || 'no stack fills the role "dependency-audit"'} (S2-010).`
    )
  } else
    messages.push('Not run: the dependency audit (S2-010) needs the network; run `harness check security --audit`.')

  const catalogue = join(root, inFramework(profile, 'core/reviews/security/probes'))
  const gaps = scriptableProbes(catalogue).filter(({ id }) => !AUTOMATED[id])
  const gapLine = !existsSync(catalogue)
    ? 'Not listed: the gaps (the catalogue of probes is not in this copy of the framework).'
    : gaps.length
      ? `${gaps.length} scriptable probes have no check yet, the gaps for the next security review: ${gaps.map(({ id }) => id).join(', ')}.`
      : 'Every scriptable probe of the catalogue has a check.'
  messages.push(gapLine)
  // Step 4 of the method gathers the gaps by hand, so every result lists them, a failing one and a quiet one too
  return { problems: found.map(note), messages, notes: [gapLine] }
}
