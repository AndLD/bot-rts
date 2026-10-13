'use client'

import DocsBrowser from '../../docs/DocsBrowser'
import { docPath } from '../../docs/structure'
import { API_URL } from '../../shared/config'
import type { Locale } from '../../shared/i18n/locales'
import { localePath } from '../config'

// The documentation on the public pages: links are addresses of the language tree the page is in
export default function SiteDocs({ locale, slug }: { locale: Locale; slug: string }) {
  return (
    <DocsBrowser
      slug={slug}
      navigation={{ hrefOf: (target) => localePath(locale, docPath(target)), apiUrl: API_URL }}
    />
  )
}
