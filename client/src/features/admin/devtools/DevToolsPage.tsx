'use client'

import { Alert, Button, Card, Form, Input, InputNumber, Space, Table } from 'antd'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { DEV_TOOLS_MAX_PLAYERS, ITestPlayer, RESET_CONFIRMATION } from '@lib/utils/admin-devtools'
import {
  useDevToolsRemoveTestPlayersMutation,
  useDevToolsResetDatabaseMutation,
  useDevToolsSeedWorldMutation,
  useDevToolsStatusQuery
} from '../../../shared/api'
import ActionModal, { ActionValues } from '../players/ActionModal'
import { useReportFailure } from '../use-report-failure'

type Pending = { type: 'seed'; count: number } | { type: 'remove' } | { type: 'reset' }

// Dev tools (design §25.3): test players with bases, for a development or test server. A server without them answers 404.
export default function DevToolsPage() {
  const t = useTranslations('admin.devtools')
  const report = useReportFailure()
  const { isError, isLoading } = useDevToolsStatusQuery()
  const [seed, seedState] = useDevToolsSeedWorldMutation()
  const [remove, removeState] = useDevToolsRemoveTestPlayersMutation()
  const [reset, resetState] = useDevToolsResetDatabaseMutation()
  const [pending, setPending] = useState<Pending | null>(null)
  const [players, setPlayers] = useState<ITestPlayer[]>([])
  const [notice, setNotice] = useState<string | null>(null)

  if (isLoading) {
    return null
  }
  if (isError) {
    return <Alert type="info" message={t('disabled')} />
  }

  async function submit({ reason, confirmation }: ActionValues) {
    const current = pending as Pending

    if (current.type === 'seed') {
      const result = await seed({ seedWorldDto: { count: current.count, reason } })
      if (report(result)) {
        return
      }
      setPlayers((result as { data: { players: ITestPlayer[] } }).data.players)
      setNotice(null)
    } else if (current.type === 'reset') {
      const result = await reset({ resetDatabaseDto: { reason, confirmation: confirmation as string } })
      if (report(result)) {
        return
      }
      const body = (result as { data: { tablesEmptied: number; accountsErased: number } }).data
      setPlayers([])
      setNotice(t('reset.done', { tables: body.tablesEmptied, accounts: body.accountsErased }))
    } else {
      const result = await remove({ reasonDto: { reason } })
      if (report(result)) {
        return
      }
      setPlayers([])
      setNotice(t('removed', { count: (result as { data: { removed: number } }).data.removed }))
    }
    setPending(null)
  }

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Alert type="warning" message={t('warning')} />
      {notice ? <Alert type="success" message={notice} closable onClose={() => setNotice(null)} /> : null}
      <Card size="small" title={t('seed.title')}>
        <Form
          layout="inline"
          initialValues={{ count: 3 }}
          onFinish={({ count }: { count: number }) => setPending({ type: 'seed', count })}
        >
          <Form.Item name="count" label={t('seed.count')} rules={[{ required: true }]}>
            <InputNumber min={1} max={DEV_TOOLS_MAX_PLAYERS} precision={0} />
          </Form.Item>
          <Button type="primary" htmlType="submit">
            {t('seed.create')}
          </Button>
        </Form>
        {players.length ? (
          <Table
            style={{ marginTop: 12 }}
            size="small"
            rowKey="userId"
            pagination={false}
            dataSource={players}
            columns={[
              { title: t('email'), dataIndex: 'email' },
              { title: t('password'), dataIndex: 'password' },
              { title: t('botPassword'), dataIndex: 'botPassword' },
              { title: t('base'), dataIndex: 'baseId', render: (id: string | null) => id ?? t('noBase') }
            ]}
          />
        ) : null}
      </Card>
      <Card size="small" title={t('remove.title')}>
        <p>{t('remove.help')}</p>
        <Button danger onClick={() => setPending({ type: 'remove' })}>
          {t('remove.button')}
        </Button>
      </Card>
      <Card size="small" title={t('reset.title')}>
        <p>{t('reset.help')}</p>
        <Button danger onClick={() => setPending({ type: 'reset' })}>
          {t('reset.button')}
        </Button>
      </Card>
      <ActionModal
        title={
          pending?.type === 'seed'
            ? t('seed.confirm', { count: pending.count })
            : pending?.type === 'reset'
              ? t('reset.confirm')
              : t('remove.confirm')
        }
        isOpen={pending !== null}
        isLoading={seedState.isLoading || removeState.isLoading || resetState.isLoading}
        onSubmit={submit}
        onCancel={() => setPending(null)}
      >
        {pending?.type === 'reset' ? (
          <Form.Item
            name="confirmation"
            label={t('reset.type', { word: RESET_CONFIRMATION })}
            rules={[{ required: true, pattern: new RegExp(`^${RESET_CONFIRMATION}$`) }]}
          >
            <Input autoComplete="off" />
          </Form.Item>
        ) : null}
      </ActionModal>
    </Space>
  )
}
