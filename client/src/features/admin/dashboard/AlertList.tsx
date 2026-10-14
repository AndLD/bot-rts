'use client'

import { Button, Empty, List, Tag } from 'antd'
import { useTranslations } from 'next-intl'
import { hasPermission, IAlert } from '@lib/utils/admin'
import { useMonitoringAcknowledgeMutation } from '../../../shared/api'
import { useAdminMe } from '../admin-me-context'

const SEVERITY_COLOR = { yellow: 'gold', red: 'red' } as const

// The open alerts, newest threshold crossings first; an admin who may acknowledge can mark one as seen
export default function AlertList({ alerts }: { alerts: readonly IAlert[] }) {
  const t = useTranslations('admin.dashboard')
  const { role } = useAdminMe()
  const [acknowledge, { isLoading }] = useMonitoringAcknowledgeMutation()
  const canAcknowledge = hasPermission(role, 'alerts.acknowledge')

  if (alerts.length === 0) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('noAlerts')} />
  }

  return (
    <List
      dataSource={[...alerts]}
      renderItem={(alert) => (
        <List.Item
          actions={
            canAcknowledge && !alert.acknowledgedAt
              ? [
                  <Button key="ack" size="small" loading={isLoading} onClick={() => acknowledge({ id: alert._id })}>
                    {t('acknowledge')}
                  </Button>
                ]
              : []
          }
        >
          <Tag color={SEVERITY_COLOR[alert.severity]}>{t(`severity.${alert.severity}`)}</Tag>
          <span>{t(`metrics.${alert.metric}`)}</span>
          {alert.acknowledgedAt ? <Tag>{t('acknowledged')}</Tag> : null}
        </List.Item>
      )}
    />
  )
}
