'use client'

import { Alert, Button, Drawer, Form, Input, Select, Space, Table, Tag } from 'antd'
import { useState } from 'react'
import { useFormatter, useTranslations } from 'next-intl'
import { LOG_LEVELS, LOG_PAGE_MAX, LogLevelName } from '@lib/utils/admin-logs'
import { useLogsNodesQuery, useLogsSearchQuery } from '../../../shared/api'
import TraceView from './TraceView'

const LEVEL_COLOR: Record<LogLevelName, string> = { info: 'default', warn: 'gold', error: 'red' }
const PAGE = 100

interface Filters {
  q?: string
  level?: LogLevelName
  requestId?: string
  traceId?: string
  userId?: string
  botId?: string
  node?: string
}

const TRACE_REF = /^[\w.-]{1,64}$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// The log of the nodes (design §25.3): by a part of the text, request, trace, player, bot, level and node. With the log store it
// spans every node and shows the trace id of each line; without it, it is the recent log of the node that answers.
export default function LogSearch() {
  const t = useTranslations('admin.logs')
  const format = useFormatter()
  const [filters, setFilters] = useState<Filters>({})
  const [results, setResults] = useState(PAGE)
  const [openTrace, setOpenTrace] = useState<string | null>(null)
  const { data, isFetching, isError, refetch } = useLogsSearchQuery({ ...filters, results })
  const { data: nodes } = useLogsNodesQuery()

  const search = (values: Filters) => {
    setResults(PAGE)
    setFilters(values)
  }

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Form layout="inline" onFinish={search} style={{ rowGap: 8 }}>
        <Form.Item name="q">
          <Input allowClear placeholder={t('text')} />
        </Form.Item>
        <Form.Item name="requestId" rules={[{ pattern: /^[\w.-]{1,64}$/ }]}>
          <Input allowClear placeholder={t('requestId')} />
        </Form.Item>
        <Form.Item name="traceId" rules={[{ pattern: /^[0-9a-f]{32}$/ }]}>
          <Input allowClear placeholder={t('traceId')} />
        </Form.Item>
        <Form.Item name="userId" rules={[{ pattern: UUID }]}>
          <Input allowClear placeholder={t('userId')} />
        </Form.Item>
        <Form.Item name="botId" rules={[{ pattern: UUID }]}>
          <Input allowClear placeholder={t('botId')} />
        </Form.Item>
        <Form.Item name="node">
          <Select
            allowClear
            placeholder={t('allNodes')}
            style={{ width: 220 }}
            options={(nodes ?? []).map((node) => ({
              value: node.id,
              label: `${node.id} (${node.services.join(', ')})`
            }))}
          />
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
      <Input.Search
        allowClear
        style={{ maxWidth: 560 }}
        placeholder={t('openTraceById')}
        enterButton={t('openTrace')}
        onSearch={(value) => TRACE_REF.test(value.trim()) && setOpenTrace(value.trim())}
      />
      {isError ? <Alert type="error" message={t('loadFailed')} /> : null}
      {data ? (
        <span>
          {data.capacity === null
            ? t('shownStore', { shown: data.lines.length, total: data.total })
            : t('shown', { shown: data.lines.length, total: data.total, capacity: data.capacity })}
        </span>
      ) : null}
      <Table
        size="small"
        rowKey={(line) => `${line.at}-${line.node}-${line.message}`}
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
          {
            title: t('node'),
            dataIndex: 'node',
            width: 200,
            render: (node: string | null, line) => (node ? `${node} · ${line.service ?? ''}` : '–')
          },
          {
            title: t('traceId'),
            dataIndex: 'traceId',
            width: 360,
            render: (id: string | null) =>
              id ? (
                <Space size={4} wrap>
                  <code>{id}</code>
                  <Button size="small" type="link" onClick={() => setOpenTrace(id)}>
                    {t('openTrace')}
                  </Button>
                </Space>
              ) : (
                '–'
              )
          },
          {
            title: t('message'),
            dataIndex: 'message',
            render: (message: string) => <code style={{ whiteSpace: 'pre-wrap' }}>{message}</code>
          }
        ]}
      />
      <Drawer
        open={openTrace !== null}
        onClose={() => setOpenTrace(null)}
        width={1000}
        title={t('trace.title')}
        destroyOnClose
      >
        {openTrace ? <TraceView id={openTrace} /> : null}
      </Drawer>
      {data && data.lines.length < data.total && data.lines.length >= results && results < LOG_PAGE_MAX ? (
        <Button onClick={() => setResults(results + PAGE)}>{t('more')}</Button>
      ) : null}
    </Space>
  )
}
