import type { Metadata } from 'next'
import { DOC_PAGES, docPath, findDocPage } from '../../docs/structure'
import type { Locale } from '../../shared/i18n/locales'
import { pageMetadata } from '../seo'
import { siteMessages } from '../siteMessages'
import { SitePage } from '../SitePage'
import SiteDocs from './SiteDocs'

// The addresses of the pages of the documentation inside a language tree, for the static build and the sitemap
export const docSlugs = () => DOC_PAGES.map((page) => (page.slug === '' ? [] : page.slug.split('/')))

type Pages = Record<string, { title: string; lead?: string; intro?: string }>

export function docsMetadata(locale: Locale, slugParts: string[] | undefined): Metadata {
  const slug = (slugParts ?? []).join('/')
  const page = findDocPage(slug)
  const docs = siteMessages(locale).docs as { title: string; pages: Pages }

  if (!page) {
    return {}
  }
  const entry = docs.pages[page.id]

  return pageMetadata({
    locale,
    path: docPath(slug),
    title: `${entry.title} — ${docs.title} — Bot RTS`,
    description: entry.lead ?? entry.intro ?? docs.title
  })
}

export function DocsView({ locale, slugParts }: { locale: Locale; slugParts: string[] | undefined }) {
  const slug = (slugParts ?? []).join('/')

  return (
    <SitePage locale={locale} path={docPath(slug)}>
      <SiteDocs locale={locale} slug={slug} />
    </SitePage>
  )
}
