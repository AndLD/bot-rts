// The bootstrap (design §6): one engine behind three front ends. `harness init` (interactive or with flags), the template repository and
// `BOOTSTRAP.md` only fill the profile file; `bootstrap` completes it from the defaults (the schema, the selected adapters, `profile/starter.json`)
// and the answers, writes the scaffolded files once, vendors the framework and generates the managed files (the engine of `sync`), commits the
// result as the first commit of the integration branch, creates the production branch, installs the Git hooks and runs every check. Since all
// three front ends end in the same completion, the same answers give the same tree (the sameness test).
import { execFileSync } from 'node:child_process'
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'
import { listAdapters, loadAdapterModules } from './adapters.mjs'
import { checkAll } from './checks.mjs'
import {
  LOCK_FILE,
  MODES,
  VENDOR_DIR,
  frameworkDir as profileFrameworkDir,
  inFramework,
  profileHash,
  readLock,
  selectedAdapters,
  writeLock
} from './lock.mjs'
import { planSummary } from './plan.mjs'
import { PROFILE_FILE, loadProfile, readSchema, validate, withDefaults } from './profile.mjs'
import { render, valueAt } from './render.mjs'
import { readManifest, resolveSource } from './source.mjs'
import { hashTree } from './tree.mjs'
import { detach, recordSelf, selectFiles, sync, vendor } from './vendor.mjs'

/** The framework tree this command runs from. */
export const FRAMEWORK_DIR = resolve(import.meta.dirname, '..', '..')
export const SCAFFOLD_DIR = 'core/templates/scaffold'
export const STARTER_PATH = 'profile/starter.json'
export const BOOTSTRAP_PROMPT = 'BOOTSTRAP.md'
export const DEFAULT_DETACH_REASON = 'started detached, with harness init --detached'
// The files of a template repository that serve only its own start; the bootstrap replaces or removes them
export const TEMPLATE_FILES = Object.freeze(['README.md', BOOTSTRAP_PROMPT])
// A regular expression that matches nothing: the term list of a kind the project has no words for yet
export const NO_TERMS = '(?!)'
const COVERAGE_MEASURES = ['statements', 'branches', 'functions', 'lines']

/**
 * The roles that `harness init` asks, in the order of `profile/roles.md`. `required` ones have no default and stop a non-interactive run;
 * `axis` ones name adapters of the framework; `coverageGate` is one percentage for every measure.
 */
export const QUESTIONS = Object.freeze([
  { role: 'project.name', flag: 'name', required: true, label: 'Project name' },
  { role: 'repository.slug', flag: 'repository', required: true, label: 'Repository on its host (owner/name)' },
  { role: 'adapters.stacks', flag: 'stack', required: true, list: true, axis: 'stack', label: 'Stack adapters' },
  { role: 'adapters.runtimes', flag: 'runtime', list: true, axis: 'runtime', label: 'Agent-runtime adapters' },
  { role: 'adapters.host', flag: 'host', axis: 'host', label: 'Repository host adapter' },
  { role: 'coverageGate', number: true, label: 'Coverage gate, in percent of every measure' },
  { role: 'branches.production', label: 'Production branch' },
  { role: 'branches.integration', label: 'Integration branch' }
])

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
const escapeRegExp = (text) => String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const adapterName = (entry) => (typeof entry === 'string' ? entry : entry?.adapter)

/** `object` with `value` at the dotted `path`; the objects on the way are created. */
export function setRole(object, path, value) {
  const keys = path.split('.')
  let node = object
  for (const key of keys.slice(0, -1)) {
    node[key] = isObject(node[key]) ? node[key] : {}
    node = node[key]
  }
  node[keys.at(-1)] = value
  return object
}

// The schema of the role at a dotted path
const schemaAt = (schema, path) => path.split('.').reduce((node, key) => node?.properties?.[key], schema)

/** The default that `init` offers for a question: the starter's (`profile/starter.json`), else the schema's; the coverage gate's is that of its measures. */
export function questionDefault(question, { schema = readSchema(), starter = readStarter() } = {}) {
  const role = question.role === 'coverageGate' ? 'coverageGate.lines' : question.role
  return valueAt(starter, role) ?? schemaAt(schema, role)?.default
}

// The value of a question in a profile, as one value (the coverage gate is a percentage when all its measures agree)
export function questionValue(profile, question) {
  const value = valueAt(profile, question.role)
  if (question.role === 'coverageGate' && isObject(value)) {
    const values = new Set(COVERAGE_MEASURES.map((measure) => value[measure]))
    return values.size === 1 ? [...values][0] : undefined
  }
  return value
}

/** Writes the answer to a question into `profile`; the coverage gate's one percentage goes to each measure. */
export function setAnswer(profile, question, value) {
  if (question.role === 'coverageGate') {
    COVERAGE_MEASURES.forEach((measure) => setRole(profile, `coverageGate.${measure}`, value))
    return profile
  }
  return setRole(profile, question.role, value)
}

// A copy without empty strings and nulls, which a template's profile file uses for the roles still to be answered
function withoutEmpty(value) {
  if (Array.isArray(value)) {
    return value.map(withoutEmpty)
  }
  if (!isObject(value)) {
    return value
  }
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, item]) => item !== '' && item !== null)
      .map(([key, item]) => [key, withoutEmpty(item)])
  )
}

/** `base` with every value of `defaults` it lacks, objects merged key by key; `base` wins. Neither input is changed. */
export function mergeUnder(base, defaults = {}) {
  const result = structuredClone(base)
  for (const [key, value] of Object.entries(defaults)) {
    if (result[key] === undefined) {
      result[key] = structuredClone(value)
    } else if (isObject(result[key]) && isObject(value)) {
      result[key] = mergeUnder(result[key], value)
    }
  }
  return result
}

/** `value` with the keys of each object in the order of the schema's properties, the others after them in their own order. */
export function canonical(value, schema = {}) {
  if (Array.isArray(value)) {
    return value.map((item) => canonical(item, schema.items ?? {}))
  }
  if (!isObject(value)) {
    return value
  }
  const known = Object.keys(schema.properties ?? {}).filter((key) => key in value)
  const others = Object.keys(value).filter((key) => !known.includes(key))
  const childSchema = (key) =>
    schema.properties?.[key] ?? (isObject(schema.additionalProperties) ? schema.additionalProperties : {})
  return Object.fromEntries([...known, ...others].map((key) => [key, canonical(value[key], childSchema(key))]))
}

/** The text of a profile file: canonical order, two spaces, a final line break. */
export const serializeProfile = (profile, schema = readSchema()) =>
  `${JSON.stringify(canonical(profile, schema), null, 2)}\n`

/** The adapters of a framework tree by axis and name: `{ stack: { 'node-ts': manifest }, … }`. */
export function adapterCatalogue(frameworkDir = FRAMEWORK_DIR) {
  const catalogue = { stack: {}, runtime: {}, host: {} }
  for (const { axis, name, manifest } of listAdapters(join(frameworkDir, 'adapters'))) {
    catalogue[axis][name] = manifest
  }
  return catalogue
}

// The manifests of the adapters a profile selects, unknown names left out (`unknownAdapters` names them)
function selectedManifests(profile, catalogue) {
  const { stacks, runtimes, host } = selectedAdapters(profile)
  return [
    ...stacks.map((name) => catalogue.stack[name]),
    ...runtimes.map((name) => catalogue.runtime[name]),
    ...(host ? [catalogue.host[host]] : [])
  ].filter(Boolean)
}

/** The term lists of a new project (the CORE scan's, profile section 9), derived from its answers and the words of its stacks. */
export function derivedTerms(profile, catalogue) {
  const stackTerms = selectedAdapters(profile)
    .stacks.map((name) => catalogue.stack[name]?.terms)
    .filter(Boolean)
  const values = [
    ...[profile.branches?.production, profile.branches?.integration]
      .filter(Boolean)
      .map((branch) => `\`${escapeRegExp(branch)}\``),
    ...(profile.repository?.slug ? [escapeRegExp(profile.repository.slug)] : [])
  ]
  return {
    stack: stackTerms.join('|') || NO_TERMS,
    product: profile.project?.name ? `\\b${escapeRegExp(profile.project.name)}\\b` : NO_TERMS,
    productGeneric: NO_TERMS,
    projectValues: values.join('|') || NO_TERMS
  }
}

// The starting values name the vendored framework as `harness/…`; a project whose framework folder is another (`paths.frameworkDir`, `.` for the
// framework's own repository) gets them pointed there
const FRAMEWORK_PATH = /\bharness\/(?=(?:core|tools|adapters)\/)/g
export function retarget(value, dir) {
  if (typeof value === 'string') {
    return value.replace(FRAMEWORK_PATH, dir === '.' ? '' : `${dir}/`)
  }
  if (Array.isArray(value)) {
    return value.map((item) => retarget(item, dir))
  }
  return value && typeof value === 'object'
    ? Object.fromEntries(Object.entries(value).map(([key, item]) => [key, retarget(item, dir)]))
    : value
}

/**
 * The complete profile of a new project from its answers: the defaults of the questions (which select the adapters), then the selected adapters'
 * `defaults`, then the other starter values; the title and the term lists are derived. An answer always wins, and an empty string counts as no
 * answer.
 */
export function completeProfile(
  answers,
  { catalogue = adapterCatalogue(), schema = readSchema(), starter = readStarter() } = {}
) {
  let profile = withoutEmpty(structuredClone(answers ?? {}))
  for (const question of QUESTIONS) {
    const fallback = questionDefault(question, { schema, starter })
    if (valueAt(profile, question.role) === undefined && fallback !== undefined) {
      setAnswer(profile, question, structuredClone(fallback))
    }
  }
  const dir = profile.paths?.frameworkDir
  const pointed = (defaults) => (dir && dir !== VENDOR_DIR ? retarget(defaults, dir) : defaults)
  for (const manifest of selectedManifests(profile, catalogue)) {
    profile = mergeUnder(profile, pointed(manifest.defaults))
  }
  profile = mergeUnder(profile, pointed(starter))
  if (dir && dir !== VENDOR_DIR && valueAt(profile, 'documents.method') === undefined) {
    setRole(profile, 'documents.method', retarget(`${VENDOR_DIR}/core/method/method.md`, dir))
  }
  if (profile.project?.name && !profile.project.title) {
    profile.project.title = profile.project.name
  }
  profile.terms = mergeUnder(profile.terms ?? {}, derivedTerms(profile, catalogue))
  return canonical(profile, schema)
}

/** The starting values of `profile/starter.json`. */
export function readStarter(frameworkDir = FRAMEWORK_DIR) {
  return JSON.parse(readFileSync(join(frameworkDir, STARTER_PATH), 'utf8')).profile
}

/** The required questions a profile leaves unanswered, as roles. */
export function missingAnswers(profile) {
  return QUESTIONS.filter((question) => {
    const value = valueAt(profile, question.role)
    return question.required && (value === undefined || value === '' || (Array.isArray(value) && value.length === 0))
  }).map((question) => question.role)
}

/** The adapters a profile selects that the framework does not have, each as a sentence that lists the ones it has. */
export function unknownAdapters(profile, catalogue) {
  const { stacks, runtimes, host } = selectedAdapters(profile)
  const wanted = [
    ...stacks.map((name) => ['stack', name]),
    ...runtimes.map((name) => ['runtime', name]),
    ...(host ? [['host', host]] : [])
  ]
  return wanted
    .filter(([axis, name]) => !catalogue[axis][name])
    .map(
      ([axis, name]) =>
        `the framework has no ${axis} adapter "${name}"; it has ${Object.keys(catalogue[axis]).join(', ') || 'none'}`
    )
}

// A phrase per axis for the scaffolded stack file: each adapter with its description
function adapterPhrase(names, manifests, none) {
  const phrases = names.map((name) => `${name} (${(manifests[name]?.description ?? '').replace(/\.$/, '')})`)
  return phrases.length ? phrases.join('; ') : none
}

/**
 * The adapters' Node modules of a framework tree, by axis and name (`loadAdapterModules`), for the roles the bootstrap calls.
 * @returns {Promise<{ stack: object, runtime: object, host: object }>}
 */
export async function loadModules(frameworkDir) {
  const dir = join(frameworkDir, 'adapters')
  return {
    stack: await loadAdapterModules('stack', dir),
    runtime: await loadAdapterModules('runtime', dir),
    host: await loadAdapterModules('host', dir)
  }
}

// The function of an adapter that fills a logic role, or undefined
function roleFunction(adapter, role) {
  const entry = adapter?.manifest.roles[role]
  return entry?.module ? adapter.modules[entry.module]?.[entry.export] : undefined
}

/**
 * The scaffolded files of a new project (design §6.3): the core templates of `core/templates/scaffold/` rendered with the profile, and the files
 * of each selected adapter's `scaffold-files` role. A file that several of them name must be a list of lines (the Git ignore file), and the lines
 * are joined in order without repeats; any other path named twice is an error.
 * @returns {{ path: string, content: string }[]} sorted by path
 */
export function scaffoldPlan({ profile, frameworkDir = FRAMEWORK_DIR, modules }) {
  const catalogue = adapterCatalogue(frameworkDir)
  const { stacks, runtimes, host } = selectedAdapters(profile)
  const context = {
    ...profile,
    scaffold: {
      stacks: adapterPhrase(stacks, catalogue.stack, 'none yet'),
      runtimes: adapterPhrase(
        runtimes,
        catalogue.runtime,
        'none (the agent-neutral minimum: the entry file, its procedures, the Git hooks and CI)'
      ),
      host: adapterPhrase(host ? [host] : [], catalogue.host, 'none')
    }
  }

  const contributions = []
  const map = JSON.parse(readFileSync(join(frameworkDir, SCAFFOLD_DIR, 'scaffold.json'), 'utf8'))
  for (const entry of map.files) {
    const path = render(entry.path, context, { document: '' }).trim()
    if (!path) {
      continue // a role the profile leaves empty: the project has no such file
    }
    const text = readFileSync(join(frameworkDir, SCAFFOLD_DIR, entry.template), 'utf8')
    contributions.push(
      entry.lines
        ? { path, lines: text.split('\n').filter(Boolean) }
        : { path, content: render(text, context, { document: path }) }
    )
  }
  const jobs = []
  for (const name of stacks) {
    contributions.push(...(roleFunction(modules.stack[name], 'scaffold-files')?.(profile) ?? []))
    const ciJobs = roleFunction(modules.stack[name], 'ci-job-layout')
    if (ciJobs) {
      jobs.push(ciJobs(profile))
    }
  }
  for (const name of runtimes) {
    contributions.push(...(roleFunction(modules.runtime[name], 'scaffold-files')?.(profile) ?? []))
  }
  if (host) {
    contributions.push(...(roleFunction(modules.host[host], 'scaffold-files')?.(profile, { jobs }) ?? []))
  }

  const files = new Map()
  for (const item of contributions) {
    const previous = files.get(item.path)
    if (!previous) {
      files.set(item.path, item.lines ? { path: item.path, lines: [...item.lines] } : item)
    } else if (previous.lines && item.lines) {
      previous.lines.push(...item.lines.filter((line) => !previous.lines.includes(line)))
    } else {
      throw new Error(`${item.path} is written by two parts of the scaffold; only a file of lines may be shared`)
    }
  }
  return [...files.values()]
    .map((file) => (file.lines ? { path: file.path, content: `${file.lines.join('\n')}\n` } : file))
    .sort((a, b) => a.path.localeCompare(b.path))
}

// A framework tree for the bootstrap: `--from`, the template repository's own `harness/`, or the framework this command runs from
function frameworkFor({ root, from, to, template, self }) {
  if (self) {
    // The framework's own repository: the tree at the root is the source
    return {
      source: { type: 'path', location: '.' },
      version: readManifest(root).version,
      manifest: readManifest(root),
      dir: root,
      cleanup: () => {}
    }
  }
  if (from) {
    return resolveSource({ root, from, to, lock: null })
  }
  if (template) {
    const dir = mkdtempSync(join(tmpdir(), 'harness-template-'))
    cpSync(join(root, VENDOR_DIR), dir, { recursive: true })
    return {
      source: template.source,
      version: template.version,
      manifest: readManifest(dir),
      dir,
      cleanup: () => rmSync(dir, { recursive: true, force: true })
    }
  }
  if (!relative(join(root, VENDOR_DIR), FRAMEWORK_DIR).startsWith('..')) {
    throw new Error(
      `this command runs from the project's own ${VENDOR_DIR}/, which records no source: pass --from <folder or Git URL>`
    )
  }
  return resolveSource({ root, from: FRAMEWORK_DIR, to, lock: null })
}

const git = (root, ...args) =>
  execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
const gitSucceeds = (root, ...args) => {
  try {
    git(root, ...args)
    return true
  } catch {
    return false
  }
}

/**
 * The Git part of the bootstrap (design §6.1): the output is committed first, as the root commit of the integration branch in an empty
 * repository, or on an integration branch made from the existing commit (one a host created); then the production branch is made from the same
 * commit; the Git hooks are installed last, so that their guard of the protected branches never sees the bootstrap's own commit.
 * @returns {string[]} what it did
 */
export function setUpGit({ root, profile, version, regenerate = () => {} }) {
  const { production, integration } = profile.branches
  const messages = []
  const topLevel = gitSucceeds(root, 'rev-parse', '--show-toplevel') ? git(root, 'rev-parse', '--show-toplevel') : null
  if (!topLevel || realpathSync(topLevel) !== realpathSync(root)) {
    git(root, 'init', '--quiet')
    messages.push('Created a Git repository.')
  }
  const hasBranch = (branch) => gitSucceeds(root, 'show-ref', '--verify', '--quiet', `refs/heads/${branch}`)
  const commit = () => {
    git(root, 'add', '--all')
    // The layer map lists the files Git tracks, so the managed files are generated again once the whole output is staged
    regenerate()
    git(root, 'add', '--all')
    git(root, 'commit', '--quiet', '-m', `chore: bootstrap the harness from harness-framework ${version}`)
  }

  if (!gitSucceeds(root, 'rev-parse', '--verify', '--quiet', 'HEAD')) {
    git(root, 'symbolic-ref', 'HEAD', `refs/heads/${integration}`)
    commit()
    messages.push(`Committed the bootstrap as the root commit of ${integration}.`)
  } else if (!hasBranch(integration)) {
    const base = git(root, 'rev-parse', '--short', 'HEAD')
    git(root, 'checkout', '--quiet', '-b', integration)
    commit()
    messages.push(`Made ${integration} from the existing commit ${base} and committed the bootstrap on it.`)
  } else {
    messages.push(
      `${integration} exists already, so the bootstrap committed nothing: commit its files on a work branch and open a pull request.`
    )
  }
  if (!hasBranch(production) && hasBranch(integration)) {
    git(root, 'branch', production, integration)
    messages.push(`Made ${production} from the same commit.`)
  }
  const hooks = inFramework(profile, 'tools/git-hooks')
  git(root, 'config', 'core.hooksPath', hooks)
  messages.push(`Installed the Git hooks (core.hooksPath ${hooks}).`)
  return messages
}

/** The owner's steps after a bootstrap, which the tools cannot do. */
export function nextSteps(profile) {
  const { production, integration } = profile.branches
  return [
    'Next steps (yours):',
    `  1. Push both branches once, to the repository ${profile.repository.slug} on its host: git push --no-verify -u origin ${integration} ${production}`,
    '     The Git hooks refuse every push to the protected branches, so this first push is the only one that skips them.',
    `  2. Protect both branches: node ${inFramework(profile, 'tools/harness.mjs')} host protect`,
    `  3. Read the scaffolded files (${profile.paths.entryFile}, the stack file, the plan) and fill in what is the project's.`,
    '  4. Do all further work on work branches, through pull requests (the Git rules of the entry file).'
  ]
}

/**
 * `harness bootstrap`: the engine on the project's profile file (design §6.1). It refuses to overwrite a scaffolded file that exists, unless
 * `force`; the files of a template repository (`TEMPLATE_FILES`) are replaced. With `detached`, the result equals a pinned bootstrap followed
 * by `harness detach`.
 * @returns {Promise<{ code: number, messages: string[] }>} `code` is that of `harness check all` on the result
 */
export async function bootstrap({
  root,
  from,
  to,
  force = false,
  detached = false,
  self = false,
  reason = DEFAULT_DETACH_REASON,
  out = () => {},
  err = () => {}
}) {
  if (self && (detached || from)) {
    throw new Error(
      '--self takes the framework tree at the root of the project, so it cannot be combined with --detached or --from'
    )
  }
  const profilePath = join(root, PROFILE_FILE)
  if (!existsSync(profilePath)) {
    throw new Error(`there is no ${PROFILE_FILE}: run \`harness init\`, or write it as ${BOOTSTRAP_PROMPT} says`)
  }
  const lock = readLock(root)
  if (lock && !lock.template && !force) {
    throw new Error(`${LOCK_FILE} exists, so this project is bootstrapped already: \`harness sync\` keeps it current`)
  }
  const template = lock?.template ? lock : null
  const fetched = frameworkFor({ root, from, to, template, self })
  try {
    const schema = readSchema()
    const catalogue = adapterCatalogue(fetched.dir)
    const profile = completeProfile(JSON.parse(readFileSync(profilePath, 'utf8')), {
      catalogue,
      schema,
      starter: readStarter(fetched.dir)
    })
    const missing = missingAnswers(profile)
    if (missing.length) {
      throw new Error(`the profile file has no value for ${missing.join(', ')}`)
    }
    const problems = [...unknownAdapters(profile, catalogue), ...validate(schema, withDefaults(schema, profile))]
    if (problems.length) {
      throw new Error(`the profile file is not valid:\n  ${problems.join('\n  ')}`)
    }

    const planned = scaffoldPlan({
      profile: withDefaults(schema, profile),
      frameworkDir: fetched.dir,
      modules: await loadModules(fetched.dir)
    })
    // The framework's own repository has files of its own where the scaffold has them too (the README, the changelog, the license): they stay
    const kept = self ? planned.filter(({ path }) => existsSync(join(root, path))) : []
    const files = planned.filter((file) => !kept.includes(file))
    const replaceable = new Set(template?.template ?? [])
    const existing = files.filter(({ path }) => existsSync(join(root, path)) && !replaceable.has(path))
    if (existing.length && !force) {
      throw new Error(
        `refusing to overwrite ${existing.map(({ path }) => path).join(', ')}: a scaffolded file is the project's once written; ` +
          'pass --force to write it again'
      )
    }

    writeFileSync(profilePath, serializeProfile(profile, schema))
    for (const { path, content } of files) {
      mkdirSync(dirname(join(root, path)), { recursive: true })
      writeFileSync(join(root, path), content)
    }
    for (const path of template?.template ?? []) {
      if (!files.some((file) => file.path === path)) {
        rmSync(join(root, path), { force: true })
      }
    }
    const messages = [`Wrote ${PROFILE_FILE} and ${files.length} scaffolded files.`]
    if (kept.length) {
      messages.push(`Kept the files of the framework itself: ${kept.map(({ path }) => path).join(', ')}.`)
    }
    messages.push(
      ...(self
        ? recordSelf({ root, manifest: fetched.manifest, adapters: selectedAdapters(profile) })
        : vendor({ root, fetched, adapters: selectedAdapters(profile) })
      ).messages
    )
    messages.push(planSummary({ root, profile: loadProfile(root), check: false }).message)
    if (detached) {
      messages.push(...detach({ root, reason }).messages)
    }
    const effective = withDefaults(schema, profile)
    messages.push(
      ...setUpGit({
        root,
        profile: effective,
        version: fetched.version,
        regenerate: () => sync({ root, local: true })
      })
    )
    messages.forEach((line) => out(line))

    const code = checkAll({ root, out, err, stdio: 'pipe' })
    nextSteps(effective).forEach((line) => out(line))
    return { code, messages }
  } finally {
    fetched.cleanup()
  }
}

/** The profile file of a template repository: the questions with their defaults, and the required ones empty, for the user or an agent to fill. */
export function templateProfile(options) {
  const profile = {}
  for (const question of QUESTIONS) {
    const fallback = questionDefault(question, options)
    setAnswer(profile, question, fallback !== undefined ? structuredClone(fallback) : question.list ? [] : '')
  }
  return profile
}

/**
 * `harness template <dir>`: the template repository (design §6.2), built from a framework tree by the engine itself, so it cannot drift: the
 * whole framework with every adapter in `harness/`, a lock that records the source and marks the template's own files, the profile file of
 * `templateProfile`, `BOOTSTRAP.md` and a README that says how to start.
 * @returns {{ messages: string[] }}
 */
export function buildTemplate({ out, from, to }) {
  if (existsSync(out) && readdirSync(out).length > 0) {
    throw new Error(`${out} is not empty; the template is built into an empty folder`)
  }
  mkdirSync(out, { recursive: true })
  const fetched = resolveSource({ root: out, from: from ?? FRAMEWORK_DIR, to, lock: null })
  try {
    const catalogue = adapterCatalogue(fetched.dir)
    const adapters = {
      stacks: Object.keys(catalogue.stack).sort(),
      runtimes: Object.keys(catalogue.runtime).sort(),
      hosts: Object.keys(catalogue.host).sort()
    }
    const paths = selectFiles(fetched.dir, fetched.manifest, adapters)
    for (const path of paths) {
      mkdirSync(dirname(join(out, VENDOR_DIR, path)), { recursive: true })
      cpSync(join(fetched.dir, path), join(out, VENDOR_DIR, path))
    }
    writeFileSync(join(out, PROFILE_FILE), serializeProfile(templateProfile()))
    cpSync(join(fetched.dir, BOOTSTRAP_PROMPT), join(out, BOOTSTRAP_PROMPT))
    const readme = readFileSync(join(fetched.dir, SCAFFOLD_DIR, 'template-readme.md'), 'utf8')
    writeFileSync(join(out, 'README.md'), render(readme, { version: fetched.version }, { document: 'README.md' }))
    writeLock(out, {
      framework: fetched.manifest.name,
      mode: MODES.pinned,
      version: fetched.version,
      source: fetched.source,
      adapters,
      template: [...TEMPLATE_FILES],
      files: hashTree(join(out, VENDOR_DIR), paths),
      managed: {},
      profile: profileHash(out)
    })
    return {
      messages: [
        `Built the template repository of ${fetched.manifest.name} ${fetched.version} in ${out}: ${paths.length} framework files.`
      ]
    }
  } finally {
    fetched.cleanup()
  }
}
