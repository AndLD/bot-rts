import { render } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import en from '../../messages/en.json'
import ru from '../../messages/ru.json'
import { localePath } from '../site/config'
import { withFallback } from '../shared/i18n/locales'
import DocsBrowser from './DocsBrowser'
import { DocsNavigation } from './DocsContext'
import { DOC_PAGES, docPath, findDocPage } from './structure'

// The link checker of the documentation (design §15.5): every page, in both languages, on the public pages and in the Help window, has
// no broken link and no broken anchor. A link is broken when it leads to a page that does not exist.
const API_URL = 'http://api.test'
const LANGUAGES = ['en', 'ru'] as const

function renderPage(slug: string, language: 'en' | 'ru', navigation: DocsNavigation) {
  const messages = language === 'ru' ? withFallback(en, ru) : en

  return render(
    <NextIntlClientProvider locale={language} messages={messages as never} timeZone="UTC">
      <DocsBrowser slug={slug} navigation={navigation} />
    </NextIntlClientProvider>
  )
}

const slugOfAddress = (href: string, language: 'en' | 'ru') => {
  const prefix = localePath(language, '/docs')
  const rest = href.slice(prefix.length).replace(/^\//, '')

  return href === prefix || href.startsWith(`${prefix}/`) ? rest : null
}

describe.each(LANGUAGES)('the links of the documentation in %s', (language) => {
  it('on the public pages lead to pages of the same language, or to the API reference', () => {
    const navigation: DocsNavigation = { hrefOf: (slug) => localePath(language, docPath(slug)), apiUrl: API_URL }

    for (const page of DOC_PAGES) {
      const { container, unmount } = renderPage(page.slug, language, navigation)

      for (const anchor of Array.from(container.querySelectorAll('a'))) {
        const href = anchor.getAttribute('href') as string
        const slug = slugOfAddress(href, language)

        if (slug === null) {
          expect(href).toBe(`${API_URL}/api/docs`)
        } else {
          expect(findDocPage(slug)).toBeDefined()
        }
      }
      unmount()
    }
  })

  it('in the Help window lead to pages that exist and never leave the window', () => {
    const navigation: DocsNavigation = { hrefOf: (slug) => `#${slug}`, open: jest.fn(), apiUrl: API_URL }

    for (const page of DOC_PAGES) {
      const { container, unmount } = renderPage(page.slug, language, navigation)

      for (const anchor of Array.from(container.querySelectorAll('a'))) {
        const href = anchor.getAttribute('href') as string

        expect(href.startsWith('#') ? findDocPage(href.slice(1)) : href).toBeTruthy()
      }
      unmount()
    }
  })

  it('have anchors that are in the page, and no id twice', () => {
    for (const page of DOC_PAGES) {
      const { container, unmount } = renderPage(page.slug, language, {
        hrefOf: (slug) => docPath(slug),
        apiUrl: API_URL
      })
      const ids = Array.from(container.querySelectorAll('[id]')).map((element) => element.id)

      expect(new Set(ids).size).toBe(ids.length)
      for (const anchor of Array.from(container.querySelectorAll('a[href*="#"]'))) {
        const target = (anchor.getAttribute('href') as string).split('#')[1]
        expect(ids).toContain(target)
      }
      unmount()
    }
  })

  it('give every page a title and at least one more thing to read', () => {
    for (const page of DOC_PAGES) {
      const { container, unmount } = renderPage(page.slug, language, { hrefOf: docPath, apiUrl: API_URL })

      expect(container.querySelector('h1')?.textContent?.trim()).toBeTruthy()
      expect(container.querySelector('.doc-page')?.textContent?.length).toBeGreaterThan(40)
      unmount()
    }
  })
})
