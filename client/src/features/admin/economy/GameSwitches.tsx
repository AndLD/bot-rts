'use client'

import { MANUAL_CATEGORIES } from '@lib/utils/interfaces/settings'
import { Alert, Switch } from 'antd'
import { useTranslations } from 'next-intl'
import { hasPermission } from '@lib/utils/admin'
import { useAdminSettingsGetQuery, useAdminSettingsUpdateMutation } from '../../../shared/api'
import { useAdminMe } from '../admin-me-context'
import { useReportFailure } from '../use-report-failure'

// The global switches of the categories of manual control: what is off here is off for every player (design §15.1)
export default function GameSwitches() {
  const t = useTranslations('admin.economy.switches')
  const { role } = useAdminMe()
  const report = useReportFailure()
  const { data, isError } = useAdminSettingsGetQuery()
  const [update, { isLoading }] = useAdminSettingsUpdateMutation()
  const canWrite = hasPermission(role, 'balance.write')

  if (isError) {
    return <Alert type="error" message={t('loadFailed')} />
  }

  return (
    <div>
      <p>{t('help')}</p>
      {MANUAL_CATEGORIES.map((category) => (
        <div key={category} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <Switch
            size="small"
            checked={data?.categories[category] ?? true}
            disabled={!canWrite || !data}
            loading={isLoading}
            aria-label={t(`categories.${category}`)}
            onChange={async (isOn) => {
              report(await update({ updateGameSettingsDto: { categories: { [category]: isOn } } }))
            }}
          />
          <span>{t(`categories.${category}`)}</span>
        </div>
      ))}
    </div>
  )
}
