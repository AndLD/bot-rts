import { DocBlock, DocPage } from './structure'

export interface SearchHit {
  slug: string
  // The sentence that matched, or the start of the page
  snippet: string
}

export interface SearchableText {
  slug: string
  title: string
  text: string
}

// The words a block holds, from the translations: its texts, and for questions both halves
export function textOfBlock(block: DocBlock, text: (key: string) => string): string[] {
  switch (block.type) {
    case 'paragraph':
    case 'heading':
      return [text(block.key)]
    case 'list':
      return block.keys.map(text)
    case 'faq':
      return block.keys.flatMap((key) => [text(`${key}.q`), text(`${key}.a`)])
    default:
      return []
  }
}

// What is searched on each page: its title, its texts, and what its generated parts list (function names, commands, examples)
export function searchableTexts(
  pages: readonly DocPage[],
  titleOf: (page: DocPage) => string,
  textOf: (page: DocPage, key: string) => string,
  extrasOf: (page: DocPage) => string[]
): SearchableText[] {
  return pages.map((page) => ({
    slug: page.slug,
    title: titleOf(page),
    text: [...page.blocks.flatMap((block) => textOfBlock(block, (key) => textOf(page, key))), ...extrasOf(page)].join(
      '\n'
    )
  }))
}

const SNIPPET_LENGTH = 140

// Pages whose title or text holds every word of the query, titles first
export function searchDocs(index: readonly SearchableText[], query: string): SearchHit[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)

  if (words.length === 0) {
    return []
  }
  const hits = index
    .map((entry) => {
      const title = entry.title.toLowerCase()
      const text = entry.text.toLowerCase()
      const isMatch = words.every((word) => title.includes(word) || text.includes(word))
      const inTitle = words.every((word) => title.includes(word))

      return { entry, isMatch, inTitle }
    })
    .filter((candidate) => candidate.isMatch)
    .sort((a, b) => Number(b.inTitle) - Number(a.inTitle))

  return hits.map(({ entry }) => ({ slug: entry.slug, snippet: snippetOf(entry, words[0]) }))
}

function snippetOf(entry: SearchableText, word: string): string {
  const line =
    entry.text.split('\n').find((candidate) => candidate.toLowerCase().includes(word)) ?? entry.text.split('\n')[0]
  const at = Math.max(0, line.toLowerCase().indexOf(word) - 40)
  const snippet = line.slice(at, at + SNIPPET_LENGTH)

  return `${at > 0 ? '…' : ''}${snippet}${at + SNIPPET_LENGTH < line.length ? '…' : ''}`
}
