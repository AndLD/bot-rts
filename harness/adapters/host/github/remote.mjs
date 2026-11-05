// The GitHub host adapter's remote state (design §4.3, role "remote-state", task 5.8): what a flow may read of another repository without a clone of it: a file
// of its default branch and its pull requests. Every function takes `slug` (owner/name) and the `cli(args, input) → { status, stdout, stderr }` seam that tests
// replace. A failure is returned as `error`, not thrown: the status of a step then says the repository cannot be read from here.
import { runGh } from './protect.mjs'

const NOT_FOUND = /\b404\b|not found/i

/**
 * A file of the default branch of `slug`.
 * @returns {{ found: boolean, text?: string, error?: string }} `found: false` without `error` is a repository without that file
 */
export function remoteFile({ slug, path, cli = (args, input) => runGh(args, input) }) {
  const answer = cli(['api', `repos/${slug}/contents/${path}`], undefined)
  if (answer.status !== 0) {
    const said = (answer.stderr || answer.stdout || '').trim()
    return NOT_FOUND.test(said) ? { found: false } : { found: false, error: said || `gh api exited ${answer.status}` }
  }
  try {
    const file = JSON.parse(answer.stdout)
    if (file.encoding !== 'base64' || typeof file.content !== 'string') return { found: false, error: 'not a file' }
    return { found: true, text: Buffer.from(file.content, 'base64').toString('utf8') }
  } catch (error) {
    return { found: false, error: `gh api answered no JSON (${error.message})` }
  }
}

/**
 * The pull requests of `slug` (open, merged and closed) that mention `text`, newest first.
 * @returns {{ pullRequests: { number: number, title: string, url: string, state: 'open' | 'merged' | 'closed' }[], error?: string }}
 */
export function remotePullRequests({ slug, text, cli = (args, input) => runGh(args, input) }) {
  const answer = cli(
    [
      'pr',
      'list',
      '--repo',
      slug,
      '--state',
      'all',
      '--search',
      text,
      '--limit',
      '20',
      '--json',
      'number,title,url,state'
    ],
    undefined
  )
  if (answer.status !== 0)
    return {
      pullRequests: [],
      error: (answer.stderr || answer.stdout || '').trim() || `gh pr list exited ${answer.status}`
    }
  try {
    return {
      pullRequests: JSON.parse(answer.stdout).map((pr) => ({
        number: pr.number,
        title: pr.title,
        url: pr.url,
        state: String(pr.state).toLowerCase()
      }))
    }
  } catch (error) {
    return { pullRequests: [], error: `gh pr list answered no JSON (${error.message})` }
  }
}
