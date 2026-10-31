// The pure parts of reading Markdown that the checks share: text without code, the anchors of a document's headings as the repository host
// renders them, and the relative link targets of a document.

/** The text without fenced code blocks, so that an example inside a fence is neither a heading nor a link. */
export function withoutFences(text) {
  return text.replace(/^```[\s\S]*?^```/gm, '')
}

/** The text with every fenced code block blanked line by line, so that the line numbers of the rest stay true. */
export function blankFences(text) {
  return text.replace(/^```[\s\S]*?^```/gm, (block) => block.replace(/[^\n]/g, ''))
}

/** The anchor the host gives a heading: lower case, punctuation removed except `-` and `_`, each space a `-`. */
export function slugify(heading) {
  return heading
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/\s/g, '-')
}

/** The anchors of every heading of a document; a repeated heading gets `-1`, `-2`, … as on the host. */
export function headingAnchors(text) {
  const seen = new Map()
  const anchors = new Set()
  for (const [, heading] of withoutFences(text).matchAll(/^#{1,6}\s+(.+?)\s*#*$/gm)) {
    const slug = slugify(heading.replace(/[`*]|\[([^\]]*)\]\([^)]*\)/g, '$1'))
    const count = seen.get(slug) ?? 0
    seen.set(slug, count + 1)
    anchors.add(count ? `${slug}-${count}` : slug)
  }
  return anchors
}

/**
 * The relative link targets of a document (`path`, `path#anchor` or `#anchor`). Links with a scheme, links inside code and fences, and the
 * placeholders of a template (`{{…}}`, filled in when the template is rendered) are left out.
 */
export function linkTargets(text) {
  const withoutCode = withoutFences(text).replace(/`[^`\n]*`/g, '')
  return [...withoutCode.matchAll(/\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)]
    .map((match) => match[1])
    .filter((target) => !/^[a-z][a-z0-9+.-]*:/i.test(target) && !target.includes('{{'))
}

/**
 * The entries of an indexed folder (its files and subfolders, without its README) that its README does not link to. A link to a path inside a
 * subfolder covers the subfolder, and a subfolder named like a document (`charts/` next to `charts.md`) belongs to that document and is
 * covered when the document is.
 * @param {string[]} entries the names in the folder
 * @param {string[]} readmeTargets the link targets of its README (`linkTargets`)
 */
export function unindexedEntries(entries, readmeTargets) {
  const linked = new Set(
    readmeTargets
      .map((target) => target.split('#')[0].replace(/^\.\//, ''))
      .filter(Boolean)
      .map((path) => path.split('/')[0])
  )
  return entries.filter(
    (entry) =>
      entry !== 'README.md' && !linked.has(entry) && !(linked.has(`${entry}.md`) && entries.includes(`${entry}.md`))
  )
}
