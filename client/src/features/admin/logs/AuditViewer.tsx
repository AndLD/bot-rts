'use client'

import { Alert, Button, Form, Input, Select, Space, Table, Tag } from 'antd'
import { useState } from 'react'
import { useFormatter, useTranslations } from 'next-intl'
import { hasPermission } from '@lib/utils/admin'
import { useAuditListQuery } from '../../../shared/api'
import { useAdminMe } from '../admin-me-context'
import { useCsvDownload } from '../use-csv-download'
import { queryOf } from './audit-query'

const PAGE_SIZE = 25
const OUTCOMES = ['success', 'denied', 'failed'] as const

type Filters = {
  action?: string
  actorId?: string
  targetId?: string
  outcome?: (typeof OUTCOMES)[number]
  from?: string
  to?: string
}

// The audit trail (design §25.2): filters, the before and after of a change, and an export as CSV
export default function AuditViewer() {
  const t = useTranslations('admin.logs.audit')
  const format = useFormatter()
  const { role } = useAdminMe()
  const download = useCsvDownload()
  const [filters, setFilters] = useState<Filters>({})
  const [page, setPage] = useState(1)
  const { data, isFetching, isError } = useAuditListQuery({ ...filters, page, results: PAGE_SIZE })

  const exportCsv = () => download(`/api/v1/admin/audit/export?${queryOf(filters)}`, 'audit-log.csv')

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Form
        layout="inline"
        onFinish={(values: Filters) => {
          setFilters({
            ...values,
            from: values.from ? new Date(values.from).toISOString() : undefined,
            to: values.to ? new Date(`${values.to}T23:59:59.999Z`).toISOString() : undefined
          })
          setPage(1)
        }}
      >
        <Form.Item name="action">
          <Input allowClear placeholder={t('action')} />
        </Form.Item>
        <Form.Item name="actorId" rules={[{ pattern: /^[0-9a-f-]{36}$/i }]}>
          <Input allowClear placeholder={t('actorId')} />
        </Form.Item>
        <Form.Item name="targetId">
          <Input allowClear placeholder={t('targetId')} />
        </Form.Item>
        <Form.Item name="outcome">
          <Select
            allowClear
            placeholder={t('outcome')}
            style={{ width: 120 }}
            options={OUTCOMES.map((value) => ({ value, label: t(`outcomes.${value}`) }))}
          />
        </Form.Item>
        <Form.Item name="from">
          <Input type="date" aria-label={t('from')} />
        </Form.Item>
        <Form.Item name="to">
          <Input type="date" aria-label={t('to')} />
        </Form.Item>
        <Button type="primary" htmlType="submit">
          {t('filter')}
        </Button>
        {hasPermission(role, 'audit.export') ? <Button onClick={exportCsv}>{t('export')}</Button> : null}
      </Form>
      {isError ? <Alert type="error" message={t('loadFailed')} /> : null}
      <Table
        size="small"
        rowKey="_id"
        loading={isFetching}
        dataSource={data?.result ?? []}
        pagination={{
          current: page,
          pageSize: PAGE_SIZE,
          total: data?.meta.pagination.total ?? 0,
          showSizeChanger: false,
          onChange: setPage
        }}
        expandable={{
          rowExpandable: (entry) => entry.before !== null || entry.after !== null,
          expandedRowRender: (entry) => (
            <pre style={{ margin: 0 }}>{JSON.stringify({ before: entry.before, after: entry.after }, null, 2)}</pre>
          )
        }}
        columns={[
          {
            title: t('time'),
            dataIndex: 'at',
            width: 180,
            render: (at: number) => format.dateTime(new Date(at), { dateStyle: 'short', timeStyle: 'medium' })
          },
          { title: t('role'), dataIndex: 'actorRole', width: 110 },
          { title: t('action'), dataIndex: 'action' },
          {
            title: t('outcome'),
            dataIndex: 'outcome',
            width: 100,
            render: (outcome: (typeof OUTCOMES)[number]) => (
              <Tag color={outcome === 'success' ? 'green' : 'red'}>{t(`outcomes.${outcome}`)}</Tag>
            )
          },
          {
            title: t('target'),
            render: (_, entry) => (entry.targetId ? `${entry.targetType ?? ''} ${entry.targetId}` : '–')
          },
          { title: t('reason'), dataIndex: 'reason', render: (reason: string | null) => reason ?? '–' }
        ]}
      />
    </Space>
  )
}
