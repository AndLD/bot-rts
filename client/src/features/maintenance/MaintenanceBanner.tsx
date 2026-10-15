'use client'

import { Alert } from 'antd'
import { useFormatter, useTranslations } from 'next-intl'
import { useMaintenanceStatusQuery } from '../../shared/api'

const POLL_MS = 60_000

// What an admin announced of a coming maintenance, and whether the world is paused now (design §25.3, Operations). It asks the
// public status on its own, so it also shows to visitors who are not signed in.
export default function MaintenanceBanner() {
  const t = useTranslations('maintenance')
  const format = useFormatter()
  const { data } = useMaintenanceStatusQuery(undefined, { pollingInterval: POLL_MS })
  const time = (ms: number) => format.dateTime(new Date(ms), { dateStyle: 'medium', timeStyle: 'short' })

  if (!data || (!data.isPaused && !data.banner)) {
    return null
  }

  return (
    <div role="status">
      {data.isPaused ? <Alert banner type="error" message={t('paused')} /> : null}
      {data.banner ? (
        <Alert
          banner
          type="warning"
          message={data.banner.message}
          description={
            data.banner.endsAt === null
              ? t('from', { start: time(data.banner.startsAt) })
              : t('fromTo', { start: time(data.banner.startsAt), end: time(data.banner.endsAt) })
          }
        />
      ) : null}
    </div>
  )
}
