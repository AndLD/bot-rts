'use client'

import { Alert, Switch } from 'antd'
import { FEATURES, Feature } from '@lib/utils/interfaces/features'
import { hasPermission } from '@lib/utils/admin'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { useAdminFeaturesGetQuery, useAdminFeaturesUpdateMutation } from '../../../shared/api'
import { useAdminMe } from '../admin-me-context'
import ActionModal from '../players/ActionModal'
import { useReportFailure } from '../use-report-failure'

// The switches of whole features of the game (design §25.3): what is off here answers FEATURE_DISABLED for every player. Each
// change says why and goes to the audit trail.
export default function FeatureSwitches() {
  const t = useTranslations('admin.economy.features')
  const { role } = useAdminMe()
  const report = useReportFailure()
  const { data, isError } = useAdminFeaturesGetQuery()
  const [update, { isLoading }] = useAdminFeaturesUpdateMutation()
  const [pending, setPending] = useState<{ feature: Feature; isOn: boolean } | null>(null)
  const canWrite = hasPermission(role, 'balance.write')

  if (isError) {
    return <Alert type="error" message={t('loadFailed')} />
  }

  return (
    <div>
      <p>{t('help')}</p>
      {FEATURES.map((feature) => (
        <div key={feature} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <Switch
            size="small"
            checked={data?.features?.[feature] ?? true}
            disabled={!canWrite || !data}
            aria-label={t(`names.${feature}`)}
            onChange={(isOn) => setPending({ feature, isOn })}
          />
          <span>
            {t(`names.${feature}`)} <small>{t(`effects.${feature}`)}</small>
          </span>
        </div>
      ))}
      {pending ? (
        <ActionModal
          title={t(pending.isOn ? 'switchOn' : 'switchOff', { name: t(`names.${pending.feature}`) })}
          isOpen
          isLoading={isLoading}
          onCancel={() => setPending(null)}
          onSubmit={async ({ reason }) => {
            const result = await update({
              updateFeatureSwitchesDto: { features: { [pending.feature]: pending.isOn }, reason }
            })

            report(result)
            if (!('error' in result)) {
              setPending(null)
            }
          }}
        />
      ) : null}
    </div>
  )
}
