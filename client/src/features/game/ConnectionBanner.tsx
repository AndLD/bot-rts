'use client'

import { useTranslations } from 'next-intl'
import { useConnectionStatus } from '../../shared/socket/socket-context'
import './ConnectionBanner.scss'

// Tells the player that the connection to the server is lost, being re-established, or back
export default function ConnectionBanner() {
  const t = useTranslations('connection')
  const status = useConnectionStatus()

  if (status === 'connected') {
    return null
  }

  return (
    <div className={`connection-banner connection-banner-${status}`} role="status" data-testid="connection-banner">
      {t(status)}
    </div>
  )
}
