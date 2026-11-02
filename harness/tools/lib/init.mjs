// `harness init` (design §6.2): the script front end of the bootstrap. It only fills the profile file: from the profile file already there (a
// template repository's, or an earlier run's), then the flags (`--name`, `--repository`, `--stack`, `--runtime`, `--host`, `--set role=value`),
// then, unless `--non-interactive`, the answers to the questions of `QUESTIONS` that no flag answered, each offering its default. Then it runs the
// engine (`bootstrap`), which completes the file and does the rest, so a non-interactive run and an interactive one with the same answers
// give the same tree.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createInterface } from 'node:readline/promises'
import { join } from 'node:path'
import {
  QUESTIONS,
  adapterCatalogue,
  bootstrap,
  completeProfile,
  missingAnswers,
  questionDefault,
  questionValue,
  setAnswer,
  setRole
} from './bootstrap.mjs'
import { PROFILE_FILE } from './profile.mjs'

const list = (text) =>
  String(text)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

/** The value of a `--set role=value`: JSON when it parses (a number, a list, an object), otherwise the text itself. */
export function parseSet(assignment) {
  const at = assignment.indexOf('=')
  if (at <= 0) {
    throw new Error(`--set needs role=value, not "${assignment}"`)
  }
  const text = assignment.slice(at + 1)
  let value = text
  try {
    value = JSON.parse(text)
  } catch {
    // a plain text value
  }
  return [assignment.slice(0, at), value]
}

// A question's answer from its text: a list, a number, or the text
function parseAnswer(question, text) {
  if (question.list) {
    return list(text)
  }
  if (question.number) {
    const number = Number(text)
    if (!Number.isFinite(number)) {
      throw new Error(`${question.label}: "${text}" is not a number`)
    }
    return number
  }
  return text
}

const display = (value) => (Array.isArray(value) ? value.join(', ') : String(value))

/**
 * The answers of the flags over the profile file's own: `{ answers, given }`, `given` being the roles a flag set (they are not asked).
 */
export function answersFromFlags(existing, flags) {
  const answers = structuredClone(existing ?? {})
  const given = new Set()
  for (const question of QUESTIONS.filter((item) => item.flag && flags[item.flag] !== undefined)) {
    setAnswer(answers, question, parseAnswer(question, flags[question.flag]))
    given.add(question.role)
  }
  for (const assignment of flags.set ?? []) {
    const [role, value] = parseSet(assignment)
    setRole(answers, role, value)
    given.add(role)
  }
  return { answers, given }
}

/**
 * A reader of the answers: a terminal is asked line by line; piped input (or a string, in tests) is read whole and given out a line per question.
 * @returns {{ ask: (prompt: string) => Promise<string>, close: () => void }}
 */
export function lineReader(input, out) {
  if (typeof input !== 'string' && input?.isTTY) {
    const terminal = createInterface({ input, output: process.stdout })
    return { interactive: true, ask: (prompt) => terminal.question(prompt), close: () => terminal.close() }
  }
  let lines = typeof input === 'string' ? input.split('\n') : null
  const readAll = async () => {
    const chunks = []
    for await (const chunk of input) {
      chunks.push(chunk)
    }
    return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)))
      .toString('utf8')
      .split('\n')
  }
  return {
    ask: async (prompt) => {
      lines ??= await readAll()
      out(prompt)
      return (lines.shift() ?? '').trim()
    },
    close: () => {}
  }
}

/** Asks every question that no flag answered, in order; an empty answer takes the value offered (the file's, or the default). */
export async function ask(answers, given, reader, { catalogue = adapterCatalogue(), out = () => {} } = {}) {
  for (const question of QUESTIONS.filter((item) => !given.has(item.role))) {
    const current = questionValue(answers, question)
    const offered =
      current !== undefined && current !== '' && !(Array.isArray(current) && current.length === 0)
        ? current
        : questionDefault(question)
    const choices = question.axis ? ` (available: ${Object.keys(catalogue[question.axis]).join(', ') || 'none'})` : ''
    const hint =
      offered !== undefined && !(question.required && Array.isArray(offered) && offered.length === 0)
        ? ` [${display(offered)}]`
        : ''
    let reply = await reader.ask(`${question.label}${choices}${hint}: `)
    while (!reply && question.required && hint === '' && reader.interactive) {
      reply = await reader.ask(`${question.label} is required: `)
    }
    if (reply) {
      setAnswer(answers, question, parseAnswer(question, reply))
    } else if (offered !== undefined) {
      setAnswer(answers, question, structuredClone(offered))
    }
  }
  return answers
}

/**
 * `harness init`: fills the profile file and runs the bootstrap. A run that leaves a required role unanswered fails before it writes anything,
 * and names the roles.
 * @returns {Promise<{ code: number, messages: string[] }>}
 */
export async function init({ root, flags = {}, input = process.stdin, out = () => {}, err = () => {} }) {
  const path = join(root, PROFILE_FILE)
  const existing = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : {}
  const { answers, given } = answersFromFlags(existing, flags)

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
  writeFileSync(path, `${JSON.stringify(answers, null, 2)}\n`)
  return bootstrap({
    root,
    from: flags.from,
    to: flags.to,
    force: flags.force,
    detached: flags.detached,
    self: flags.self,
    reason: flags.reason,
    out,
    err
  })
}
