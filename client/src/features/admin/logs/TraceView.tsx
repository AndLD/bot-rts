'use client'

import { Alert, Descriptions, Space, Spin, Table, Tag } from 'antd'
import { useFormatter, useTranslations } from 'next-intl'
import type { LogLevelName, SpanStatusName } from '@lib/utils/admin-logs'
import { useTracesReadQuery } from '../../../shared/api'
import { layoutTrace, SpanRow } from './trace-layout'

const LEVEL_COLOR: Record<LogLevelName, string> = { info: 'default', warn: 'gold', error: 'red' }
const STATUS_COLOR: Record<SpanStatusName, string> = { unset: 'default', ok: 'green', error: 'red' }

const formatMs = (ms: number) => `${ms >= 100 ? ms.toFixed(0) : ms.toFixed(1)} ms`

// One request followed over the nodes (design §25.3): the timeline of its spans and every line written in it, by every node, in order
export default function TraceView({ id }: { id: string }) {
  const t = useTranslations('admin.logs.trace')
  const format = useFormatter()
  const { data, isFetching, isError } = useTracesReadQuery({ id })

  if (isFetching) {
    return <Spin />
  }
  if (isError || !data) {
    return <Alert type="error" message={t('loadFailed')} />
  }
  const { rows, durationMs } = layoutTrace(data.spans)
  const time = (at: number) => format.dateTime(new Date(at), { dateStyle: 'short', timeStyle: 'medium' })

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Descriptions size="small" column={1}>
        <Descriptions.Item label={t('traceId')}>
          <code>{data.traceId}</code>
        </Descriptions.Item>
        <Descriptions.Item label={t('duration')}>{rows.length ? formatMs(durationMs) : '–'}</Descriptions.Item>
      </Descriptions>
      {data.store === 'memory' ? <Alert type="info" showIcon message={t('noSpans')} /> : null}
      {data.store !== 'memory' && rows.length === 0 ? <Alert type="info" showIcon message={t('notSampled')} /> : null}
      {data.isLogCut ? <Alert type="warning" showIcon message={t('logCut')} /> : null}
      {rows.length ? (
        <Table<SpanRow>
          size="small"
          rowKey="spanId"
          pagination={false}
          dataSource={rows}
          columns={[
            {
              title: t('span'),
              dataIndex: 'name',
              render: (name: string, row) => <span style={{ paddingLeft: row.depth * 16 }}>{name}</span>
            },
            {
              title: t('node'),
              dataIndex: 'node',
              width: 190,
              render: (node: string | null, row) => (node ? `${node} · ${row.service ?? ''}` : '–')
            },
            { title: t('start'), dataIndex: 'offsetMs', width: 90, render: (ms: number) => `+${formatMs(ms)}` },
            { title: t('took'), dataIndex: 'durationMs', width: 90, render: formatMs },
            {
              title: t('status'),
              dataIndex: 'status',
              width: 80,
              render: (status: SpanStatusName) => <Tag color={STATUS_COLOR[status]}>{status}</Tag>
            },
            {
              title: t('timeline'),
              width: 240,
              render: (_: unknown, row) => (
                <div style={{ position: 'relative', height: 10, background: 'rgba(128,128,128,0.15)' }}>
                  <div
                    role="img"
                    aria-label={`${row.name} ${formatMs(row.durationMs)}`}
                    style={{
                      position: 'absolute',
                      left: `${row.left}%`,
                      width: `${row.width}%`,
                      height: 10,
                      background: row.status === 'error' ? '#cf1322' : '#1677ff'
                    }}
                  />
                </div>
              )
            }
          ]}
        />
      ) : null}
      <Table
        size="small"
        rowKey={(line) => `${line.at}-${line.node}-${line.message}`}
        pagination={false}
        dataSource={data.logs}
        columns={[
          { title: t('time'), dataIndex: 'at', width: 180, render: time },
          {
            title: t('level'),
            dataIndex: 'level',
            width: 80,
            render: (level: LogLevelName) => <Tag color={LEVEL_COLOR[level]}>{level}</Tag>
          },
          {
            title: t('node'),
            dataIndex: 'node',
            width: 190,
            render: (node: string | null, line) => (node ? `${node} · ${line.service ?? ''}` : '–')
          },
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
