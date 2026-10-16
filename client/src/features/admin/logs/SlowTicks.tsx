'use client'

import { Alert, Empty, Space, Table, Tag, Typography } from 'antd'
import { useFormatter, useTranslations } from 'next-intl'
import { useLogsSlowQueriesQuery, useLogsSlowTicksQuery } from '../../../shared/api'

// The ticks of the engine that took longer than the tick interval, newest first, and the last slow queries of the database
export default function SlowTicks() {
  const t = useTranslations('admin.logs')
  const format = useFormatter()
  const { data, isError } = useLogsSlowTicksQuery()
  const { data: queries } = useLogsSlowQueriesQuery()

  if (isError) {
    return <Alert type="error" message={t('slowFailed')} />
  }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
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
      <div>
        <Typography.Title level={5}>{t('slowQueries')}</Typography.Title>
        <Table
          size="small"
          rowKey={(query) => `${query.at}-${query.statement}`}
          pagination={false}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('noSlowQueries')} /> }}
          dataSource={queries ?? []}
          columns={[
            {
              title: t('time'),
              dataIndex: 'at',
              width: 180,
              render: (at: number) => format.dateTime(new Date(at), { dateStyle: 'short', timeStyle: 'medium' })
            },
            {
              title: t('queryDuration'),
              dataIndex: 'durationMs',
              width: 120,
              render: (ms: number) => `${Math.round(ms)} ms`
            },
            {
              title: t('statement'),
              dataIndex: 'statement',
              render: (sql: string) => <code style={{ whiteSpace: 'pre-wrap' }}>{sql}</code>
            }
          ]}
        />
      </div>
    </Space>
  )
}
