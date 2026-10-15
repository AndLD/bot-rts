'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { docSlugOfPath } from './structure'

// The "?" of every page of the console: it opens the documentation of the page the admin is on
export default function AdminHelpLink() {
  const t = useTranslations('adminDocs')
  const slug = docSlugOfPath(usePathname())

  return (
    <Link href={slug ? `/admin/docs/${slug}` : '/admin/docs'} aria-label={t('help')} title={t('help')}>
      ?
    </Link>
  )
}
