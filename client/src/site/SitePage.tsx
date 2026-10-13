import type { ReactNode } from 'react'
import type { Locale } from '../shared/i18n/locales'
import SiteFooter from './SiteFooter'
import SiteHeader from './SiteHeader'
import { SiteIntl } from './SiteIntl'
import { siteMessages } from './siteMessages'
import './site.scss'

// What every public page stands in: the texts of its language, the header and the footer
export function SitePage({ locale, path, children }: { locale: Locale; path: string; children: ReactNode }) {
  return (
    <SiteIntl locale={locale} messages={siteMessages(locale)}>
      <div className="site">
        <SiteHeader locale={locale} path={path} />
        <main className="site-main">{children}</main>
        <SiteFooter locale={locale} />
      </div>
    </SiteIntl>
  )
}
