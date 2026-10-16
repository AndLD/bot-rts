'use client'

import { CopyOutlined } from '@ant-design/icons'
import { Alert, Button, Card, Checkbox, Form, InputNumber, Input, Select, Space, Table, Tag } from 'antd'
import { useState } from 'react'
import { useFormatter, useTranslations } from 'next-intl'
import { ADMIN_API_KEY_LIMITS, ADMIN_API_SCOPES, IAdminApiKey } from '@lib/utils/admin-api-keys'
import {
  useAdminApiKeysCreateMutation,
  useAdminApiKeysListQuery,
  useAdminApiKeysRevokeMutation
} from '../../../shared/api'
import ActionModal, { ActionValues } from '../players/ActionModal'
import { useReportFailure } from '../use-report-failure'

const DEFAULT_DAYS = 7

// The generated type has plain strings for the scopes (the public spec does not list the admin scopes)
type AdminKey = Omit<IAdminApiKey, 'scopes'> & { scopes: string[] }

type Mode = { type: 'create' } | { type: 'revoke'; id: string }

// The read-only API keys with admin scopes, for an AI assistant (design §25.2): created here after the second factor of the console
// session, with a reason, an expiry and optional addresses; the secret is shown once; listed and revoked only here.
export default function AdminKeysPage() {
  const t = useTranslations('admin.apiKeys')
  const format = useFormatter()
  const report = useReportFailure()
  const { data: keys, isError } = useAdminApiKeysListQuery()
  const [create, createState] = useAdminApiKeysCreateMutation()
  const [revoke, revokeState] = useAdminApiKeysRevokeMutation()
  const [mode, setMode] = useState<Mode | null>(null)
  const [secret, setSecret] = useState<string | null>(null)
  const date = (ms: number | null) =>
    ms === null ? '–' : format.dateTime(new Date(ms), { dateStyle: 'short', timeStyle: 'short' })

  if (isError) {
    return <Alert type="error" message={t('loadFailed')} />
  }

  async function submit(values: ActionValues) {
    const result =
      mode?.type === 'revoke'
        ? await revoke({ id: mode.id, reasonDto: { reason: values.reason } })
        : await create({
            createAdminApiKeyDto: {
              name: values.name as string,
              scopes: values.scopes as string[],
              reason: values.reason,
              expiresInDays: values.expiresInDays as number,
              ipAllowList: (values.ipAllowList as string[] | undefined) ?? []
            }
          })

    if (report(result)) {
      return
    }
    if ('data' in result && result.data && typeof result.data === 'object' && 'secret' in result.data) {
      setSecret(result.data.secret as string)
    }
    setMode(null)
  }

  const state = (key: { revokedAt: number | null; expiresAt: number }) =>
    key.revokedAt !== null ? 'revoked' : key.expiresAt < Date.now() ? 'expired' : 'active'

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Alert type="info" showIcon message={t('about')} />
      {secret && (
        <Alert
          type="success"
          showIcon
          closable
          onClose={() => setSecret(null)}
          message={t('secretTitle')}
          description={
            <Space direction="vertical">
              <span>{t('secretHint')}</span>
              <Space>
                <code data-testid="admin-key-secret">{secret}</code>
                <Button
                  size="small"
                  icon={<CopyOutlined />}
                  aria-label={t('copy')}
                  onClick={() => void navigator.clipboard?.writeText(secret)}
                />
              </Space>
            </Space>
          }
        />
      )}

      <Card
        size="small"
        title={t('title')}
        extra={
          <Button type="primary" onClick={() => setMode({ type: 'create' })}>
            {t('create')}
          </Button>
        }
      >
        <Table
          size="small"
          rowKey="_id"
          pagination={false}
          dataSource={keys ?? []}
          columns={[
            { title: t('name'), dataIndex: 'name' },
            { title: t('prefix'), dataIndex: 'prefix', render: (prefix: string) => <code>{prefix}…</code> },
            {
              title: t('scopes'),
              dataIndex: 'scopes',
              render: (scopes: string[]) => scopes.map((scope) => <Tag key={scope}>{scope}</Tag>)
            },
            { title: t('reason'), dataIndex: 'reason' },
            {
              title: t('addresses'),
              dataIndex: 'ipAllowList',
              render: (addresses: string[]) => (addresses.length ? addresses.join(', ') : t('anyAddress'))
            },
            { title: t('expires'), dataIndex: 'expiresAt', render: date },
            { title: t('lastUsed'), dataIndex: 'lastUsedAt', render: date },
            {
              title: t('state.title'),
              key: 'state',
              render: (_: unknown, key: AdminKey) => {
                const current = state(key)

                return <Tag color={current === 'active' ? 'green' : 'default'}>{t(`state.${current}`)}</Tag>
              }
            },
            {
              key: 'actions',
              render: (_: unknown, key: AdminKey) =>
                key.revokedAt === null && (
                  <Button size="small" danger onClick={() => setMode({ type: 'revoke', id: key._id })}>
                    {t('revoke')}
                  </Button>
                )
            }
          ]}
        />
      </Card>

      <ActionModal
        title={mode?.type === 'revoke' ? t('revokeTitle') : t('createTitle')}
        isOpen={mode !== null}
        isLoading={createState.isLoading || revokeState.isLoading}
        initialValues={{ expiresInDays: DEFAULT_DAYS, scopes: [], ipAllowList: [] }}
        onSubmit={submit}
        onCancel={() => setMode(null)}
      >
        {mode?.type === 'create' && (
          <>
            <Form.Item
              name="name"
              label={t('name')}
              rules={[{ required: true, max: ADMIN_API_KEY_LIMITS.nameMaxLength, message: t('nameRequired') }]}
            >
              <Input maxLength={ADMIN_API_KEY_LIMITS.nameMaxLength} />
            </Form.Item>
            <Form.Item
              name="scopes"
              label={t('scopes')}
              rules={[{ required: true, type: 'array', min: 1, message: t('scopesRequired') }]}
            >
              <Checkbox.Group
                options={ADMIN_API_SCOPES.map((scope) => ({
                  value: scope,
                  label: `${scope} — ${t(`scopeHelp.${scope}`)}`
                }))}
                style={{ display: 'grid', gap: 4 }}
              />
            </Form.Item>
            <Form.Item
              name="expiresInDays"
              label={t('expiresInDays')}
              extra={t('expiresHint')}
              rules={[{ required: true, type: 'number', min: 1, max: ADMIN_API_KEY_LIMITS.maxExpiresInDaysCeiling }]}
            >
              <InputNumber min={1} max={ADMIN_API_KEY_LIMITS.maxExpiresInDaysCeiling} />
            </Form.Item>
            <Form.Item name="ipAllowList" label={t('addresses')} extra={t('addressesHint')}>
              <Select mode="tags" open={false} tokenSeparators={[',', ' ']} />
            </Form.Item>
          </>
        )}
      </ActionModal>
    </Space>
  )
}
