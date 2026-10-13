'use client'

import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { DocsNavigationContext, DocsNavigation } from './DocsContext'
import DocLink from './DocLink'
import DocPageView from './DocPageView'
import { useDocsSearch } from './useDocsSearch'
import { DOC_GROUPS, DocPage, findDocPage, pagesOfGroup } from './structure'
import './docs.scss'

interface Props {
  slug: string
  navigation: DocsNavigation
}

// The documentation: the tree of pages, a search box and the page (design §15.5). The public /docs routes and the Help window of the
// game both show this, with links that fit the place.
export default function DocsBrowser({ slug, navigation }: Props) {
  const t = useTranslations('docs')
  const search = useDocsSearch()
  const [query, setQuery] = useState('')
  const page = findDocPage(slug) as DocPage
  const hits = search(query)
  const open = (target: string) => {
    setQuery('')
    navigation.open?.(target)
  }

  return (
    <DocsNavigationContext.Provider value={{ ...navigation, open: navigation.open ? open : undefined }}>
      <div className="docs">
        <aside className="docs-side">
          <input
            type="search"
            className="docs-search"
            aria-label={t('search.label')}
            placeholder={t('search.placeholder')}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <nav aria-label={t('nav.tree')}>
            {DOC_GROUPS.map((group) => (
              <section key={group}>
                <h2>{t(`groups.${group}`)}</h2>
                <ul>
                  {pagesOfGroup(group).map((entry) => (
                    <li key={entry.slug} aria-current={entry.slug === slug ? 'page' : undefined}>
                      <DocLink slug={entry.slug} />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </nav>
        </aside>
        <div className="docs-main">
          {query.trim() ? (
            <section className="docs-results" aria-live="polite">
              <p>{hits.length === 0 ? t('search.none') : t('search.results', { count: hits.length })}</p>
              <ul>
                {hits.map((hit) => (
                  <li key={hit.slug}>
                    <DocLink slug={hit.slug} />
                    <small>{hit.snippet}</small>
                  </li>
                ))}
              </ul>
            </section>
          ) : (
            <DocPageView page={page} />
          )}
        </div>
      </div>
    </DocsNavigationContext.Provider>
  )
}
