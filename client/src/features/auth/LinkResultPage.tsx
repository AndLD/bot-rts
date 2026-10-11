'use client'

import { LoadingOutlined } from '@ant-design/icons'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useEffect, useRef, useState } from 'react'
import { useAuth } from './auth-client-context'
import './AuthPage.scss'

export type LinkAction = 'confirmEmailChange' | 'confirmAccountDeletion'

// Opened from an emailed link: confirms the action with the token of the link and tells how it went. A confirmed change
// ends the old sessions, so the page also signs the player out locally.
export default function LinkResultPage({ action }: { action: LinkAction }) {
  const t = useTranslations('auth.confirm')
  const auth = useAuth()
  const token = useSearchParams().get('token')
  const [outcome, setOutcome] = useState<'working' | 'done' | 'failed'>('working')
  // A link works once, so it must be sent once even when React runs the effect twice in development
  const confirmedToken = useRef<string | null | undefined>(undefined)

  useEffect(() => {
    if (confirmedToken.current === token) {
      return
    }
    confirmedToken.current = token

    auth[action](token ?? '').then(async (result) => {
      if (result.ok) {
        await auth.signOut()
      }
      setOutcome(result.ok ? 'done' : 'failed')
    })
  }, [auth, action, token])

  const messages =
    action === 'confirmEmailChange'
      ? { done: t('emailChange.done'), failed: t('emailChange.failed') }
      : { done: t('accountDeletion.done'), failed: t('accountDeletion.failed') }

  return (
    <div className="auth-page">
      <div className="auth-card">
        {outcome === 'working' ? <LoadingOutlined /> : <p>{messages[outcome]}</p>}
        <Link href="/auth" className="auth-link">
          {t('toLogin')}
        </Link>
      </div>
    </div>
  )
}
