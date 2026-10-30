// Checks every relative link in the repository's Markdown files: the target must exist, must not be git-ignored,
// and a "#anchor" into another Markdown file must match one of its headings.
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' })

// The vendored framework (`harness/`) is checked at its source, where its links resolve; its copies of the source's links leave the copy
const markdownFiles = git('ls-files', '*.md')
  .split('\n')
  .filter((file) => file && !file.startsWith('harness/'))

function slugify(heading) {
  return heading
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s/g, '-')
}

const anchorCache = new Map()

function anchorsOf(file) {
  if (!anchorCache.has(file)) {
    const text = readFileSync(file, 'utf8').replace(/^```[\s\S]*?^```/gm, '')
    const seen = new Map()
    const anchors = new Set()
    for (const [, heading] of text.matchAll(/^#{1,6}\s+(.+?)\s*#*$/gm)) {
      const slug = slugify(heading.replace(/[`*_]|\[([^\]]*)\]\([^)]*\)/g, '$1'))
      const count = seen.get(slug) ?? 0
      seen.set(slug, count + 1)
      anchors.add(count ? `${slug}-${count}` : slug)
    }
    anchorCache.set(file, anchors)
  }
  return anchorCache.get(file)
}

function isIgnored(path) {
  try {
    git('check-ignore', '-q', path)
    return true
  } catch {
    return false
  }
}

const errors = []

for (const file of markdownFiles) {
  const text = readFileSync(join(root, file), 'utf8').replace(/^```[\s\S]*?^```/gm, '')
  const withoutInlineCode = text.replace(/`[^`\n]*`/g, '')

  for (const [, target] of withoutInlineCode.matchAll(/\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
    // An external address, or a placeholder of a template (the profile template of the framework fills its links in)
    if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.includes('{{')) {
      continue
    }

    const [pathPart, anchor] = target.split('#')
    const resolved = pathPart ? resolve(root, dirname(file), decodeURIComponent(pathPart)) : join(root, file)
    const display = relative(root, resolved)

    if (!existsSync(resolved)) {
      errors.push(`${file}: broken link "${target}" (no such file ${display})`)
    } else if (isIgnored(display)) {
      errors.push(`${file}: link "${target}" points to a git-ignored file`)
    } else if (anchor && resolved.endsWith('.md') && statSync(resolved).isFile() && !anchorsOf(resolved).has(anchor)) {
      errors.push(`${file}: link "${target}" has no matching heading`)
    }
  }
}

if (errors.length) {
  console.error(errors.join('\n'))
  process.exit(1)
}

console.log(`Checked links in ${markdownFiles.length} Markdown files.`)
