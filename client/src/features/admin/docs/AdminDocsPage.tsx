'use client'

import { Input, Layout, Menu } from 'antd'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { searchableTexts, searchDocs } from '../../../docs/search'
import { AlertsTable, AuditActionsList, PermissionsTable } from './AdminDocParts'
import { ADMIN_DOC_GROUPS, ADMIN_DOC_PAGES, AdminDocPage, adminPagesOfGroup, findAdminDocPage } from './structure'

const GENERATED = { permissions: PermissionsTable, auditActions: AuditActionsList, alerts: AlertsTable }

const hrefOf = (slug: string) => (slug ? `/admin/docs/${slug}` : '/admin/docs')

function PageView({ page }: { page: AdminDocPage }) {
  const t = useTranslations('adminDocs')
  const text = (key: string) => t(`pages.${page.id}.${key}`)

  return (
    <article>
      <h1>{text('title')}</h1>
      {page.blocks.map((block, index) => {
        switch (block.type) {
          case 'paragraph':
            return <p key={index}>{text(block.key)}</p>
          case 'heading':
            return <h2 key={index}>{text(block.key)}</h2>
          case 'list':
            return (
              <ul key={index}>
                {block.keys.map((key) => (
                  <li key={key}>{text(key)}</li>
                ))}
              </ul>
            )
          case 'see': {
            // A test makes sure that every page named here exists
            const target = findAdminDocPage(block.slug) as AdminDocPage

            return (
              <p key={index}>
                {t('seeAlso')} <Link href={hrefOf(block.slug)}>{t(`pages.${target.id}.title`)}</Link>
              </p>
            )
          }
          case 'generated': {
            const Part = GENERATED[block.kind]

            return <Part key={index} />
          }
        }
      })}
    </article>
  )
}

// The documentation of the console (design §25.3, Docs): the tree of pages, a search box and the page. Only admins reach it: it is
// inside the console, which is never public or indexed.
export default function AdminDocsPage() {
  const t = useTranslations('adminDocs')
  const params = useParams<{ slug?: string[] }>()
  const slug = (params.slug ?? []).join('/')
  const page = findAdminDocPage(slug) ?? (findAdminDocPage('') as AdminDocPage)
  const [query, setQuery] = useState('')
  const index = useMemo(
    () =>
      searchableTexts(
        ADMIN_DOC_PAGES as never,
        (entry) => t(`pages.${entry.id}.title`),
        (entry, key) => t(`pages.${entry.id}.${key}`),
        () => []
      ),
    [t]
  )
  const hits = searchDocs(index, query)

  return (
    <Layout style={{ background: 'transparent', gap: 24, flexDirection: 'row', flexWrap: 'wrap' }}>
      <Layout.Sider width={260} theme="light" style={{ background: 'transparent' }}>
        <Input.Search
          allowClear
          aria-label={t('search.label')}
          placeholder={t('search.placeholder')}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <nav aria-label={t('tree')}>
          {ADMIN_DOC_GROUPS.map((group) => (
            <section key={group}>
              <h3>{t(`groups.${group}`)}</h3>
              <Menu
                mode="inline"
                selectedKeys={[page.slug]}
                items={adminPagesOfGroup(group).map((entry) => ({
                  key: entry.slug,
                  label: <Link href={hrefOf(entry.slug)}>{t(`pages.${entry.id}.title`)}</Link>
                }))}
              />
            </section>
          ))}
        </nav>
      </Layout.Sider>
      <Layout.Content style={{ flex: '1 1 480px', minWidth: 0 }}>
        {query.trim() ? (
          <section aria-live="polite">
            <p>{hits.length === 0 ? t('search.none') : t('search.results', { count: hits.length })}</p>
            <ul>
              {hits.map((hit) => (
                <li key={hit.slug}>
                  <Link href={hrefOf(hit.slug)} onClick={() => setQuery('')}>
                    {t(`pages.${(findAdminDocPage(hit.slug) as AdminDocPage).id}.title`)}
                  </Link>
                  <br />
                  <small>{hit.snippet}</small>
                </li>
              ))}
            </ul>
          </section>
        ) : (
          <PageView page={page} />
        )}
      </Layout.Content>
    </Layout>
  )
}
