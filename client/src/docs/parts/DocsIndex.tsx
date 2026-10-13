'use client'

import { useTranslations } from 'next-intl'
import DocLink from '../DocLink'
import { DOC_GROUPS, pagesOfGroup } from '../structure'

// The front page's list of every page, by group
export default function DocsIndex() {
  const t = useTranslations('docs')

  return (
    <div className="doc-index">
      {DOC_GROUPS.map((group) => (
        <section key={group}>
          <h2>{t(`groups.${group}`)}</h2>
          <ul>
            {pagesOfGroup(group)
              .filter((page) => page.slug !== '')
              .map((page) => (
                <li key={page.slug}>
                  <DocLink slug={page.slug} />
                </li>
              ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
