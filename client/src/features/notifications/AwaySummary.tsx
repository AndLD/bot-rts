'use client'

import { notification } from 'antd'
import { useTranslations } from 'next-intl'
import { useEffect } from 'react'
import { useNotificationsSummaryQuery } from '../../shared/api'

export const AWAY_SHOWN_KEY = 'away-summary-shown'

const wasShown = () => {
  try {
    return sessionStorage.getItem(AWAY_SHOWN_KEY) === '1'
  } catch {
    return false
  }
}

// "While you were away: 12 events, 2 attacks, 1 achievement" (design §24.3): once per visit, when the player arrives and
// notifications wait unread
export default function AwaySummary() {
  const t = useTranslations('notifications.away')
  const { data } = useNotificationsSummaryQuery()

  useEffect(() => {
    if (!data || data.unread === 0 || wasShown()) {
      return
    }
    try {
      sessionStorage.setItem(AWAY_SHOWN_KEY, '1')
    } catch {
      // The summary then comes again on the next page load
    }
    notification.info({
      message: t('title'),
      description: t('summary', {
        total: data.unread,
        attacks: data.byCategory.attacks ?? 0,
        achievements: data.byCategory.achievements ?? 0
      })
    })
  }, [data, t])

  return null
}
