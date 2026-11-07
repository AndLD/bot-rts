// `harness flow prompt` and `next` (task 5.4): the prompt of one step, rendered from the standard wording of the template `core/plan/flow-step-prompts.md`
// (written once there) and the step's kind and scope; a `custom` step carries its own text, the section `## Step <#>` of the flow file. Pure functions on texts.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { inFramework } from './lock.mjs'
import { repoWords } from './flow-repos.mjs'
import { stepIds } from './flow-status.mjs'
import { REPORT_CAP } from './step-report.mjs'

export const PROMPT_TEMPLATE = 'core/plan/flow-step-prompts.md'
const WORD = /\{(\w+)\}/g
// The sections every kind gets after its own text; the Git wording is for the kinds that open pull requests of tasks
const GIT_KINDS = ['tasks', 'triage-fix']
/** The kinds whose worker reads a lot, and so gets the paragraph on delegating verbose reading to a subagent (task 6.6). */
const DELEGATE_KINDS = ['tasks', 'consumer-take', 'triage-fix']
/** The most lines of the summary a subagent returns. */
export const SUMMARY_LINES = 10

/** The sections of the template by the name of their `##` heading, without their comments: `{ header: '…', tasks: '…' }`. */
export function promptSections(template) {
  const sections = {}
  for (const part of template.split(/^## /m).slice(1)) {
    const [name, ...body] = part.split('\n')
    sections[name.trim()] = body
      .join('\n')
      .replace(/<!--[\s\S]*?-->/g, '')
      .trim()
  }
  return sections
}

/** `text` with its `{words}` filled from `values`; a line with a word that has no value is left out. */
export function fillWords(text, values) {
  return text
    .split('\n')
    .flatMap((line) => {
      let missing = false
      const filled = line.replace(WORD, (match, key) => {
        const value = values[key]
        if (value === undefined || value === null || value === '' || value === '—') {
          missing = true
          return ''
        }
        return String(value)
      })
      return missing ? [] : [filled]
    })
    .join('\n')
}

/** The text of the section `## Step <id>` of a flow file (up to the next `## `), or null. */
export function customText(flowText, id) {
  const match = flowText.match(new RegExp(`^## Step ${id}\\b[^\\n]*\\n([\\s\\S]*?)(?=^## |$(?![\\s\\S]))`, 'm'))
  return match ? match[1].trim() : null
}

// The list of the ids of a step, each with its title and whether it is done, one per line
function idList(step, facts) {
  return stepIds(step, facts)
    .map((id) => {
      const mark = facts.statuses.get(id)
      const merged = facts.merged === null || facts.merged.has(id)
      const done = mark === '✅' && merged
      return `- ${id}${facts.titles.get(id) ? ` — ${facts.titles.get(id)}` : ''}${done ? ' (done)' : mark === '🟡' ? ' (in progress: continue it)' : ''}`
    })
    .join('\n')
}

/**
 * The prompt of a step: `{ prompt, problems }`. `problems` names what stops a prompt from being rendered (an unknown step, a custom step without its text, a
 * template without a section); the prompt is then empty. `values` are the profile's words: `entryFile`, `integration`, `production`.
 */
export function renderPrompt({ flow, step: id, facts, template, values, repoPaths = {} }) {
  const step = flow.steps.find((each) => each.id === id)
  if (!step)
    return {
      prompt: '',
      problems: [`flow ${flow.number} has no step ${id}; its steps are ${flow.steps.map((each) => each.id).join(', ')}`]
    }
  const sections = promptSections(template)
  const own = step.kind === 'custom' ? customText(flow.text, step.id) : null
  const where = repoWords(step, flow.settings, repoPaths)
  const wanted = [
    'header',
    ...(where.external ? ['external'] : []),
    step.kind === 'custom' ? null : step.kind,
    ...(flow.settings.commands === 'plain' ? ['commands'] : []),
    ...(GIT_KINDS.includes(step.kind) ? ['git'] : []),
    'budget',
    ...(DELEGATE_KINDS.includes(step.kind) ? ['delegate'] : []),
    'stop',
    'report'
  ].filter(Boolean)
  const missing = wanted.filter((name) => !(name in sections))
  if (missing.length)
    return {
      prompt: '',
      problems: [`the prompt template has no section ${missing.map((name) => `"${name}"`).join(', ')}`]
    }
  if (step.kind === 'custom' && own === null) {
    return {
      prompt: '',
      problems: [`step ${step.id} is a custom step, but the flow has no section "## Step ${step.id}" with its prompt`]
    }
  }
  const words = {
    ...values,
    step: step.id,
    flow: flow.number,
    title: flow.title,
    file: flow.file,
    kind: step.kind,
    repo: where.repo,
    repoPath: where.repoPath,
    remote: where.remote,
    // The entry file named in the header is the home repository's; a worker in an external repository reads that repository's own (the section `external`)
    ...(where.external ? { entryFile: undefined } : {}),
    model: step.model,
    scope: step.scope.replace(/\s*\(executor:[^)]*\)/i, '').trim(),
    version: step.versions[0],
    reportLines: REPORT_CAP.lines,
    reportCharacters: REPORT_CAP.characters,
    summaryLines: SUMMARY_LINES,
    idList: step.kind === 'tasks' || step.kind === 'triage-fix' ? idList(step, facts) : ''
  }
  const parts = wanted.map((name) => fillWords(sections[name], words))
  if (own !== null) parts.splice(wanted.indexOf('header') + 1 + (where.external ? 1 : 0), 0, own)
  return { prompt: parts.join('\n\n'), problems: [] }
}

/** The text of the prompt template of a project (the framework's own copy: vendored, or the tree itself in mode self). */
export const readPromptTemplate = (root, profile) =>
  readFileSync(join(root, inFramework(profile, PROMPT_TEMPLATE)), 'utf8')
