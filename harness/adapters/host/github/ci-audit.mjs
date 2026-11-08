// The GitHub adapter's role "ci-audit" (host contract): the checks that the security review's probes make of the workflow files, read as text (no YAML parser, no
// download): S3-001 (the token's permissions are declared, read-only at the top and write on the job), S2-004 (an action is pinned to a full commit), S3-005 (text an outsider controls is not spliced into a
// script) and S4-018 (a privileged trigger does not check out the proposed code).
const FULL_COMMIT = /^[0-9a-f]{40}$/
const DIGEST = /^sha256:[0-9a-f]{64}$/
// The fields of an event that an outsider writes: titles, bodies, branch names, commit messages, names
const UNTRUSTED =
  /github\.(?:event\.(?:issue\.(?:title|body)|pull_request\.(?:title|body|head\.(?:ref|label|repo\.default_branch))|comment\.body|review\.body|review_comment\.body|discussion\.(?:title|body)|pages\.[\w.*\[\]]+\.page_name|commits\.[\w.*\[\]]+\.(?:message|author\.(?:email|name))|head_commit\.(?:message|author\.(?:email|name))|workflow_run\.(?:head_branch|head_commit\.message))|head_ref)/
const EXPRESSION = /\$\{\{([^}]*)\}\}/g

const indentOf = (line) => line.length - line.trimStart().length
const code = (line) => line.replace(/\s+#.*$/, '')

/** The jobs of a workflow as `{ name, line, body }`, read from the two-space-indented keys under `jobs:`. */
function jobsOf(lines) {
  const start = lines.findIndex((line) => /^jobs:\s*$/.test(line))
  if (start < 0) return []
  const jobs = []
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index]
    if (line.trim() && indentOf(line) === 0 && !line.startsWith('#')) break
    const match = /^ {2}([\w-]+):\s*$/.exec(line)
    if (match) jobs.push({ name: match[1], line: index + 1, body: [] })
    else if (jobs.length) jobs.at(-1).body.push(line)
  }
  return jobs
}

/** Whether the reference of a `uses:` is pinned: a local path, a full commit of an action, or a digest of an image. */
export function isPinned(reference) {
  if (reference.startsWith('./')) return true
  if (reference.startsWith('docker://')) return DIGEST.test(reference.split('@')[1] ?? '')
  return FULL_COMMIT.test(reference.split('@')[1] ?? '')
}

// The lines of the top-level `permissions:` of a workflow, as `{ line, text }`: the key's own line (an inline value or map) and the indented lines under it
function topPermissions(lines) {
  const start = lines.findIndex((line) => /^permissions:/.test(line))
  if (start < 0) return null
  const block = [{ line: start + 1, text: code(lines[start]) }]
  for (let index = start + 1; index < lines.length; index += 1) {
    const text = lines[index]
    if (text.trim() && indentOf(text) === 0 && !text.startsWith('#')) break
    block.push({ line: index + 1, text: code(text) })
  }
  return block
}

// S3-001 follows the probe: the token's permissions are declared, read-only at the top, and write is granted to the job that uses it
function permissionProblems(path, lines) {
  const problems = []
  const top = topPermissions(lines)
  lines.forEach((line, index) => {
    if (/^\s*permissions:\s*write-all\b/.test(line)) {
      problems.push({
        probe: 'S3-001',
        text: `${path}:${index + 1}: \`permissions: write-all\` grants every scope; list the scopes the job needs`
      })
    }
  })
  if (top) {
    for (const { line, text } of top) {
      const scope = /([\w-]+):\s*write\b/.exec(text)
      if (scope && !/write-all/.test(text)) {
        problems.push({
          probe: 'S3-001',
          text: `${path}:${line}: the workflow grants \`${scope[1]}: write\` at the top, so every job gets it; declare read-only at the top and write on the job that needs it`
        })
      }
    }
    return problems
  }
  const loose = jobsOf(lines).filter((job) => !job.body.some((line) => /^ {4}permissions:/.test(line)))
  return [
    ...problems,
    ...loose.map((job) => ({
      probe: 'S3-001',
      text: `${path}:${job.line}: the job "${job.name}" declares no \`permissions:\` and the workflow declares none at the top, so the token gets the repository's default`
    }))
  ]
}

function pinProblems(path, lines) {
  const problems = []
  lines.forEach((line, index) => {
    const match = /^\s*(?:-\s+)?uses:\s*['"]?([^\s'"#]+)/.exec(line)
    if (match && !isPinned(match[1])) {
      problems.push({
        probe: 'S2-004',
        text: `${path}:${index + 1}: \`${match[1]}\` is not pinned to a full commit hash (a tag can be moved); pin it and keep the version in a comment`
      })
    }
  })
  return problems
}

// The lines of the script steps: a `run:` on one line, or the block under `run: |`
function scriptLines(lines) {
  const found = []
  for (let index = 0; index < lines.length; index += 1) {
    const match = /^(\s*)(?:-\s+)?run:\s*(.*)$/.exec(lines[index])
    if (!match) continue
    const inline = match[2].trim()
    if (inline && !/^[|>][+-]?$/.test(inline)) found.push({ index, text: inline })
    else {
      const base = indentOf(lines[index])
      for (
        let next = index + 1;
        next < lines.length && (!lines[next].trim() || indentOf(lines[next]) > base);
        next += 1
      ) {
        found.push({ index: next, text: lines[next] })
      }
    }
  }
  return found
}

function injectionProblems(path, lines) {
  const problems = []
  for (const { index, text } of scriptLines(lines)) {
    for (const [, expression] of text.matchAll(EXPRESSION)) {
      if (UNTRUSTED.test(expression)) {
        problems.push({
          probe: 'S3-005',
          text: `${path}:${index + 1}: \`${expression.trim()}\` is text an outsider controls, spliced into a script; pass it through \`env:\` and read the variable`
        })
      }
    }
  }
  return problems
}

function targetProblems(path, lines) {
  const text = lines.map(code).join('\n')
  if (!/\bpull_request_target\b/.test(text)) return []
  const head = lines.findIndex((line) => /^\s*ref:.*(?:pull_request\.head|head_ref|head\.sha|head\.ref)/.test(line))
  if (head < 0) return []
  return [
    {
      probe: 'S4-018',
      text: `${path}:${head + 1}: a \`pull_request_target\` workflow checks out the proposed code, which then runs with the repository's token and secrets`
    }
  ]
}

/**
 * The problems of the workflow files.
 * @param {{ files: { path: string, text: string }[] }} options
 * @returns {{ probe: string, text: string }[]}
 */
export function auditCi({ files }) {
  return files.flatMap(({ path, text }) => {
    const lines = text.split('\n')
    return [
      ...permissionProblems(path, lines),
      ...pinProblems(path, lines),
      ...injectionProblems(path, lines),
      ...targetProblems(path, lines)
    ]
  })
}
