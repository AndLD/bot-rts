import en from '../../../../messages/en.json'
import ru from '../../../../messages/ru.json'
import { ADMIN_NAV } from '../admin-nav'
import {
  ADMIN_DOC_GROUPS,
  ADMIN_DOC_PAGES,
  ADMIN_PAGE_DOCS,
  adminPagesOfGroup,
  docSlugOfPath,
  findAdminDocPage
} from './structure'

const keysOf = (page: (typeof ADMIN_DOC_PAGES)[number]): string[] => [
  'title',
  ...page.blocks.flatMap((block) => {
    switch (block.type) {
      case 'paragraph':
      case 'heading':
        return [block.key]
      case 'list':
        return [...block.keys]
      default:
        return []
    }
  })
]

describe('the admin documentation', () => {
  it('has a page for every page of the console', () => {
    for (const { path } of ADMIN_NAV) {
      expect(ADMIN_PAGE_DOCS[path]).toBeDefined()
      expect(findAdminDocPage(ADMIN_PAGE_DOCS[path])).toBeDefined()
    }
  })

  it('has unique addresses, pages in known groups, and links only to pages that exist', () => {
    const slugs = ADMIN_DOC_PAGES.map((page) => page.slug)

    expect(new Set(slugs).size).toBe(slugs.length)
    expect(ADMIN_DOC_PAGES.every((page) => ADMIN_DOC_GROUPS.includes(page.group))).toBe(true)
    for (const page of ADMIN_DOC_PAGES) {
      for (const block of page.blocks) {
        if (block.type === 'see') {
          expect(findAdminDocPage(block.slug)).toBeDefined()
        }
      }
    }
    expect(ADMIN_DOC_GROUPS.every((group) => adminPagesOfGroup(group).length > 0)).toBe(true)
  })

  it.each([
    ['English', en],
    ['Russian', ru]
  ])('has every text in %s', (_language, messages) => {
    const pages = messages.adminDocs.pages as Record<string, Record<string, unknown>>

    for (const page of ADMIN_DOC_PAGES) {
      for (const key of keysOf(page)) {
        expect(typeof pages[page.id]?.[key]).toBe('string')
      }
    }
  })
})

describe('docSlugOfPath', () => {
  it('gives the page of the console the admin is on, also below it, and the front page elsewhere', () => {
    expect(docSlugOfPath('/admin')).toBe('dashboard')
    expect(docSlugOfPath('/admin/players')).toBe('players')
    expect(docSlugOfPath('/admin/players/abc')).toBe('players')
    expect(docSlugOfPath('/admin/docs/permissions')).toBe('docs')
    expect(docSlugOfPath('/elsewhere')).toBe('')
  })
})
