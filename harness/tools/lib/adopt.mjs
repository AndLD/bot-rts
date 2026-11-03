// `harness adopt` (design §6.4): the bootstrap for a repository that copied the first harness: a profile file under `scripts/`, the Git hooks, the link and plan
// scripts, a project check. It moves the profile file to the root and fills what it lacks (asking for the required roles, as `init`), writes the vendored
// framework, the lock and the managed files, points the Git hooks and the agent runtime's hook entries at the framework, lists the scripts that the framework now
// replaces (it deletes none), and lists the project's own checks in `checks.project`. It commits nothing: the result is a working tree for the project's own pull request.
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { analyzeScripts, frameworkExports } from './adopt-steps.mjs'
import {
  FRAMEWORK_DIR,
  QUESTIONS,
  adapterCatalogue,
  bootstrap,
  completeProfile,
  missingAnswers,
  unknownAdapters
} from './bootstrap.mjs'
import { answersFromFlags, ask, lineReader } from './init.mjs'
import { LOCK_FILE, readLock } from './lock.mjs'
import { PROFILE_FILE, readSchema, validate, withDefaults } from './profile.mjs'

/** Where a project that copied the first harness keeps its profile file, in the order they are tried. */
export const OLD_PROFILE_PATHS = Object.freeze(['scripts/harness-profile.json', PROFILE_FILE])

/**
 * @returns {Promise<{ code: number, messages: string[] }>} `code` is that of `harness check all` on the result
 */
export async function adopt({ root, flags = {}, input = process.stdin, out = () => {}, err = () => {} }) {
  if (readLock(root)) {
    throw new Error(
      `${LOCK_FILE} exists, so this project uses the framework already: \`harness sync\` keeps it current`
    )
  }
  const found = OLD_PROFILE_PATHS.find((path) => existsSync(join(root, path)))
  if (!found) {
    throw new Error(
      `there is no profile file to adopt (${OLD_PROFILE_PATHS.join(' or ')}): this is not a project with a copied harness; run \`harness init\``
    )
  }

  const { answers, given } = answersFromFlags(JSON.parse(readFileSync(join(root, found), 'utf8')), flags)
  if (!flags.nonInteractive) {
    const reader = lineReader(input, out)
    try {
      await ask(answers, given, reader, { out })
    } finally {
      reader.close()
    }
  }
  const missing = missingAnswers(completeProfile(answers))
  if (missing.length) {
    const flagOf = (role) => QUESTIONS.find((question) => question.role === role)?.flag
    throw new Error(
      `no value for ${missing.map((role) => (flagOf(role) ? `${role} (--${flagOf(role)})` : role)).join(', ')}`
    )
  }

  // Nothing is written until the whole profile file is valid, so a failed adoption leaves the project as it was
  const schema = readSchema()
  const completed = completeProfile(answers, { schema })
  const invalid = [
    ...unknownAdapters(completed, adapterCatalogue()),
    ...validate(schema, withDefaults(schema, completed))
  ]
  if (invalid.length) {
    throw new Error(`the profile file is not valid:\n  ${invalid.join('\n  ')}`)
  }

  // What the framework replaces, and the project's own checks, before the framework's files are in the tree
  const { replaced, checks } = analyzeScripts({ root, exports: frameworkExports(join(FRAMEWORK_DIR, 'tools')) })
  const project = [...new Set([...(answers.checks?.project ?? []), ...checks])]
  if (project.length) {
    answers.checks = { ...answers.checks, project }
  }

  writeFileSync(join(root, PROFILE_FILE), `${JSON.stringify(answers, null, 2)}\n`)
  const moved = found !== PROFILE_FILE
  if (moved) {
    rmSync(join(root, found))
  }

  const result = await bootstrap({ root, from: flags.from, to: flags.to, force: false, adopt: true, out, err })
  const messages = [...result.messages]
  const report = [
    ...(moved
      ? [
          `Moved the profile file from ${found} to ${PROFILE_FILE}, completed with the defaults of the schema and the adapters (git shows the old one as removed).`
        ]
      : []),
    ...replaced
      .filter(({ path }) => path !== found)
      .map(({ path, by }) => `Replaced by the framework, remove it in your pull request: ${path} (${by}).`),
    ...checks.map((command) => `A project check, left in place and run by \`harness check all\`: ${command}.`)
  ]
  report.forEach((line) => out(line))
  return { code: result.code, messages: [...messages, ...report] }
}
