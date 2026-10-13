'use client'

import { useTranslations } from 'next-intl'
import { findDocPage } from './structure'
import { useDocsNavigation } from './DocsContext'

// A link to a page of the documentation, named by the page's title
export default function DocLink({ slug }: { slug: string }) {
  const t = useTranslations('docs')
  const { hrefOf, open } = useDocsNavigation()
  const page = findDocPage(slug)

  if (!page) {
    return null
  }

  return (
    <a
      href={hrefOf(slug)}
      onClick={(event) => {
        if (open) {
          event.preventDefault()
          open(slug)
        }
      }}
    >
      {t(`pages.${page.id}.title`)}
    </a>
  )
}
