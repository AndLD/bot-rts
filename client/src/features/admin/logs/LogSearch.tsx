'use client'

import { Alert, Button, Form, Input, Select, Space, Table, Tag } from 'antd'
import { useState } from 'react'
import { useFormatter, useTranslations } from 'next-intl'
import { LOG_LEVELS, LogLevelName } from '@lib/utils/admin-logs'
import { useLogsSearchQuery } from '../../../shared/api'

const LEVEL_COLOR: Record<LogLevelName, string> = { info: 'default', warn: 'gold', error: 'red' }

interface Filters {
  q?: string
  level?: LogLevelName
  requestId?: string
}

// The recent log of the node that answers (design §25.3): by a part of the text (the id of a player or a bot) or by request
export default function LogSearch() {
  const t = useTranslations('admin.logs')
  const format = useFormatter()
  const [filters, setFilters] = useState<Filters>({})
  const { data, isFetching, isError, refetch } = useLogsSearchQuery({ ...filters, results: 100 })

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Form layout="inline" onFinish={(values: Filters) => setFilters(values)}>
        <Form.Item name="q">
          <Input allowClear placeholder={t('text')} />
        </Form.Item>
        <Form.Item name="requestId" rules={[{ pattern: /^[\w.-]{1,64}$/ }]}>
          <Input allowClear placeholder={t('requestId')} />
        </Form.Item>
        <Form.Item name="level">
          <Select
            allowClear
            placeholder={t('level')}
            style={{ width: 120 }}
            options={LOG_LEVELS.map((value) => ({ value, label: value }))}
          />
        </Form.Item>
        <Button type="primary" htmlType="submit">
          {t('search')}
        </Button>
        <Button onClick={() => refetch()}>{t('refresh')}</Button>
      </Form>
      {isError ? <Alert type="error" message={t('loadFailed')} /> : null}
      {data ? (
        <span>{t('shown', { shown: data.lines.length, total: data.total, capacity: data.capacity })}</span>
      ) : null}
      <Table
        size="small"
        rowKey={(line) => `${line.at}-${line.message}`}
        loading={isFetching}
        pagination={false}
        dataSource={data?.lines ?? []}
        columns={[
          {
            title: t('time'),
            dataIndex: 'at',
            width: 180,
            render: (at: number) => format.dateTime(new Date(at), { dateStyle: 'short', timeStyle: 'medium' })
          },
          {
            title: t('level'),
            dataIndex: 'level',
            width: 90,
            render: (level: LogLevelName) => <Tag color={LEVEL_COLOR[level]}>{level}</Tag>
          },
          { title: t('requestId'), dataIndex: 'requestId', width: 260, render: (id: string | null) => id ?? '–' },
          {
            title: t('message'),
            dataIndex: 'message',
            render: (message: string) => <code style={{ whiteSpace: 'pre-wrap' }}>{message}</code>
          }
        ]}
      />
    </Space>
  )
}
