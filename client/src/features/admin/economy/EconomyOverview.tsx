'use client'

import { Alert, Card, Space, Table } from 'antd'
import { useFormatter, useTranslations } from 'next-intl'
import { useBalanceOverviewQuery } from '../../../shared/api'

// What the world holds of each resource, which blueprints the players learned, and which modules exist
export default function EconomyOverview() {
  const t = useTranslations('admin.economy.overview')
  const format = useFormatter()
  const { data, isError } = useBalanceOverviewQuery()
  const number = (value: number) => format.number(value, { maximumFractionDigits: 1 })

  if (isError) {
    return <Alert type="error" message={t('loadFailed')} />
  }

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Card size="small" title={t('resources')}>
        <Table
          size="small"
          rowKey="resource"
          pagination={false}
          dataSource={data?.resources ?? []}
          columns={[
            { title: t('resource'), dataIndex: 'resource' },
            { title: t('deposits'), dataIndex: 'deposits', render: number },
            { title: t('remaining'), dataIndex: 'remaining', render: number },
            {
              title: t('share'),
              render: (_, stat) => (stat.capacity > 0 ? `${Math.round((stat.remaining / stat.capacity) * 100)} %` : '–')
            },
            { title: t('stored'), dataIndex: 'stored', render: number }
          ]}
        />
      </Card>
      <Card size="small" title={t('blueprints')}>
        <Table
          size="small"
          rowKey="module"
          pagination={{ pageSize: 10, hideOnSinglePage: true }}
          dataSource={data?.blueprints ?? []}
          columns={[
            { title: t('module'), dataIndex: 'module' },
            { title: t('research'), dataIndex: 'research' },
            { title: t('item'), dataIndex: 'item' }
          ]}
        />
      </Card>
      <Card size="small" title={t('modules')}>
        <Table
          size="small"
          rowKey="name"
          pagination={{ pageSize: 10, hideOnSinglePage: true }}
          dataSource={data?.modules ?? []}
          columns={[
            { title: t('module'), dataIndex: 'name' },
            { title: t('type'), dataIndex: 'type' },
            { title: t('count'), dataIndex: 'count' }
          ]}
        />
      </Card>
    </Space>
  )
}
