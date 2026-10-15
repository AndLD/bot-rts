'use client'

import { Alert, Empty, Table, Tag } from 'antd'
import { useTranslations } from 'next-intl'
import { useLogsSlowTicksQuery } from '../../../shared/api'

// The ticks of the engine that took longer than the tick interval, newest first
export default function SlowTicks() {
  const t = useTranslations('admin.logs')
  const { data, isError } = useLogsSlowTicksQuery()

  if (isError) {
    return <Alert type="error" message={t('slowFailed')} />
  }

  return (
    <Table
      size="small"
      rowKey="tick"
      pagination={false}
      locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('noSlowTicks')} /> }}
      dataSource={[...(data ?? [])].reverse()}
      columns={[
        { title: t('tick'), dataIndex: 'tick' },
        { title: t('duration'), render: (_, tick) => `${Math.round(tick.durationMs)} / ${tick.intervalMs} ms` },
        { title: t('queued'), dataIndex: 'queuedExecutions' },
        { title: t('deferred'), dataIndex: 'deferredExecutions' },
        {
          title: t('cut'),
          dataIndex: 'isCut',
          render: (cut: boolean) => (cut ? <Tag color="red">{t('yes')}</Tag> : '–')
        }
      ]}
    />
  )
}
