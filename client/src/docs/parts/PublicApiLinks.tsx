'use client'

import { useTranslations } from 'next-intl'
import { useDocsNavigation } from '../DocsContext'

// Where the public API is described (design §22.1)
export default function PublicApiLinks() {
  const t = useTranslations('docs.publicApi')
  const { apiUrl } = useDocsNavigation()

  return (
    <>
      <ul>
        <li>
          {t('openapi')}: <a href={`${apiUrl}/api/docs`}>{`${apiUrl}/api/docs`}</a>
        </li>
        <li>
          {t('basePath')}: <code>/api/v1</code>
        </li>
      </ul>
      <p>{t('keys')}</p>
      <p>{t('rules')}</p>
    </>
  )
}
