'use client'

import { CopyOutlined } from '@ant-design/icons'
import { Alert, Button, Checkbox, Form, Input, InputNumber, List, Modal, Popconfirm, Select, Tag } from 'antd'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { API_KEY_LIMITS, API_SCOPES, ApiScope } from '../../../../lib/utils/interfaces/api-keys'
import { useApiKeysCreateMutation, useApiKeysListQuery, useApiKeysRevokeMutation } from '../../shared/api'
import { useErrorMessage } from '../../shared/errors'
import { errorNotification } from '../../shared/notifications'

interface CreateForm {
  name: string
  scopes: ApiScope[]
  ratePerMinute: number
  // 0: the key does not expire
  expiresInDays: number
}

const EXPIRY_CHOICES = [0, 30, 90, 365] as const

// The API keys of the player (design §22.1): the list, a form that makes a key and shows its secret once, and revocation
export default function ApiKeysCard() {
  const t = useTranslations('apiKeys')
  const getErrorMessage = useErrorMessage()
  const { data: keys } = useApiKeysListQuery()
  const [create, { isLoading: isCreating }] = useApiKeysCreateMutation()
  const [revoke] = useApiKeysRevokeMutation()
  const [form] = Form.useForm<CreateForm>()
  const [isFormOpen, setFormOpen] = useState(false)
  const [secret, setSecret] = useState<string | null>(null)

  const failureOf = (error: unknown) => {
    const body = (error as { data?: { code?: string; error?: string } }).data

    return getErrorMessage({ code: body?.code, message: body?.error })
  }

  async function submit(values: CreateForm) {
    const result = await create({
      createApiKeyDto: {
        name: values.name,
        scopes: values.scopes,
        ratePerMinute: values.ratePerMinute,
        expiresInDays: values.expiresInDays || undefined
      }
    })

    if ('error' in result) {
      errorNotification(failureOf(result.error))
      return
    }
    setFormOpen(false)
    form.resetFields()
    setSecret(result.data.secret)
  }

  const closeSecret = () => setSecret(null)

  async function remove(id: string) {
    const result = await revoke({ id })

    if ('error' in result) {
      errorNotification(failureOf(result.error))
    }
  }

  const stateOf = (key: { revokedAt: number | null; expiresAt: number | null }) =>
    key.revokedAt ? 'revoked' : key.expiresAt && key.expiresAt < Date.now() ? 'expired' : 'active'

  return (
    <div className="api-keys">
      <p>{t('intro')}</p>
      <List
        locale={{ emptyText: t('none') }}
        dataSource={keys ?? []}
        renderItem={(key) => {
          const state = stateOf(key)

          return (
            <List.Item
              key={key._id}
              actions={
                state === 'active'
                  ? [
                      <Popconfirm
                        key="revoke"
                        title={t('revokeConfirm')}
                        okText={t('revoke')}
                        onConfirm={() => remove(key._id)}
                      >
                        <Button danger size="small">
                          {t('revoke')}
                        </Button>
                      </Popconfirm>
                    ]
                  : []
              }
            >
              <List.Item.Meta
                title={
                  <>
                    {key.name} <Tag color={state === 'active' ? 'green' : 'default'}>{t(`state.${state}`)}</Tag>
                  </>
                }
                description={
                  <>
                    <code>{key.prefix}…</code>{' '}
                    {key.scopes.map((scope) => (
                      <Tag key={scope}>{scope}</Tag>
                    ))}
                    <div>
                      {t('rate', { count: key.ratePerMinute })} ·{' '}
                      {key.lastUsedAt
                        ? t('lastUsed', { date: new Date(key.lastUsedAt).toLocaleString() })
                        : t('neverUsed')}
                      {key.expiresAt
                        ? ` · ${t('expires', { date: new Date(key.expiresAt).toLocaleDateString() })}`
                        : ''}
                    </div>
                  </>
                }
              />
            </List.Item>
          )
        }}
      />
      <Button type="primary" onClick={() => setFormOpen(true)}>
        {t('create')}
      </Button>

      <Modal
        open={isFormOpen}
        title={t('create')}
        okText={t('createSubmit')}
        confirmLoading={isCreating}
        onOk={() => form.submit()}
        onCancel={() => setFormOpen(false)}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{ scopes: ['read'], ratePerMinute: API_KEY_LIMITS.defaultRatePerMinute, expiresInDays: 0 }}
          onFinish={submit}
        >
          <Form.Item
            name="name"
            label={t('name')}
            rules={[{ required: true, whitespace: true, max: API_KEY_LIMITS.nameMaxLength }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="scopes"
            label={t('scopes')}
            rules={[{ required: true, type: 'array', min: 1 }]}
            extra={t('scopesHelp')}
          >
            <Checkbox.Group>
              {API_SCOPES.map((scope) => (
                <div key={scope}>
                  <Checkbox value={scope}>
                    <code>{scope}</code> {t(`scope.${scope}`)}
                  </Checkbox>
                </div>
              ))}
            </Checkbox.Group>
          </Form.Item>
          <Form.Item name="ratePerMinute" label={t('ratePerMinute')}>
            <InputNumber min={1} max={API_KEY_LIMITS.maxRatePerMinute} />
          </Form.Item>
          <Form.Item name="expiresInDays" label={t('expiry')}>
            <Select
              options={EXPIRY_CHOICES.map((days) => ({
                value: days,
                label: days === 0 ? t('neverExpires') : t('expiresInDays', { count: days })
              }))}
            />
          </Form.Item>
        </Form>
      </Modal>

      {secret !== null && (
        <Modal
          open
          title={t('created')}
          footer={<Button onClick={closeSecret}>{t('done')}</Button>}
          onCancel={closeSecret}
        >
          <Alert type="warning" showIcon message={t('shownOnce')} />
          <Input readOnly value={secret} aria-label={t('secret')} style={{ marginTop: 12 }} />
          <Button
            icon={<CopyOutlined />}
            style={{ marginTop: 8 }}
            onClick={() => void navigator.clipboard?.writeText(secret)}
          >
            {t('copy')}
          </Button>
        </Modal>
      )}
    </div>
  )
}
