'use client'

import { Alert, Button, Card, Descriptions, Empty, Form, Input, List, Space, Spin, Table, Tag, Timeline } from 'antd'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useFormatter, useTranslations } from 'next-intl'
import { hasPermission } from '@lib/utils/admin'
import { usePlayersAddNoteMutation, usePlayersProfileQuery } from '../../../shared/api'
import { useErrorMessage } from '../../../shared/errors'
import { errorNotification } from '../../../shared/notifications'
import { useAdminMe } from '../admin-me-context'
import PlayerActions from './PlayerActions'
import { STATUS_COLOR } from './PlayersPage'

// The profile of one player (design §25.3): who they are, what they own, what happened to the account, and the actions
export default function PlayerProfilePage() {
  const t = useTranslations('admin.players')
  const format = useFormatter()
  const getErrorMessage = useErrorMessage()
  const { role } = useAdminMe()
  const { id } = useParams<{ id: string }>()
  const { data: player, isLoading, isError } = usePlayersProfileQuery({ id })
  const [addNote, { isLoading: isAdding }] = usePlayersAddNoteMutation()
  const [form] = Form.useForm<{ text: string }>()
  const date = (ms: number | null) =>
    ms === null ? '–' : format.dateTime(new Date(ms), { dateStyle: 'medium', timeStyle: 'short' })

  if (isLoading) {
    return <Spin />
  }
  if (isError || !player) {
    return <Alert type="error" message={t('loadFailed')} />
  }

  async function submitNote({ text }: { text: string }) {
    const result = await addNote({ id, addNoteDto: { text } })

    if ('error' in result) {
      const body = (result.error as { data?: { code?: string; error?: string } }).data
      errorNotification(getErrorMessage({ code: body?.code, message: body?.error }))
      return
    }
    form.resetFields()
  }

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Link href="/admin/players">{t('back')}</Link>
      {player.activeBan ? (
        <Alert
          type="error"
          showIcon
          message={t('banned', {
            until: player.activeBan.expiresAt ? date(player.activeBan.expiresAt) : t('untilLifted')
          })}
          description={player.activeBan.reason}
        />
      ) : null}
      {player.isDeleted ? <Alert type="warning" showIcon message={t('deleted')} /> : null}

      <Card title={player.name} extra={<Tag color={STATUS_COLOR[player.status]}>{t(`status.${player.status}`)}</Tag>}>
        <Descriptions column={{ xs: 1, md: 2 }}>
          <Descriptions.Item label={t('columns.email')}>{player.email}</Descriptions.Item>
          <Descriptions.Item label={t('columns.verified')}>
            {player.isEmailVerified ? t('filters.verifiedYes') : t('filters.verifiedNo')}
          </Descriptions.Item>
          <Descriptions.Item label={t('columns.registered')}>{date(player.createdAt)}</Descriptions.Item>
          <Descriptions.Item label={t('columns.lastLogin')}>{date(player.lastLoginAt)}</Descriptions.Item>
          <Descriptions.Item label={t('profile.bots')}>{player.botCount}</Descriptions.Item>
          <Descriptions.Item label={t('profile.executions')}>{player.runningExecutions}</Descriptions.Item>
          <Descriptions.Item label={t('profile.resources')}>
            {player.resources.length
              ? player.resources.map((stack) => `${stack.resource}: ${stack.amount}`).join(', ')
              : '–'}
          </Descriptions.Item>
        </Descriptions>
        <PlayerActions player={player} />
      </Card>

      <Card size="small" title={t('profile.bases')}>
        <List
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
          dataSource={player.bases}
          renderItem={(base) => (
            <List.Item>
              {base.label ?? base._id} · {t('profile.botsOfBase', { count: base.botCount })}
            </List.Item>
          )}
        />
      </Card>

      <Card size="small" title={t('profile.sessions')}>
        <Table
          size="small"
          rowKey="_id"
          pagination={false}
          dataSource={player.sessions}
          columns={[
            { title: t('profile.signedIn'), dataIndex: 'createdAt', render: date },
            { title: t('profile.lastUsed'), dataIndex: 'lastUsedAt', render: date },
            { title: t('profile.device'), dataIndex: 'userAgent', render: (value: string | null) => value ?? '–' },
            {
              title: t('columns.status'),
              dataIndex: 'isActive',
              render: (value: boolean) => (
                <Tag color={value ? 'green' : 'default'}>{value ? t('profile.active') : t('profile.ended')}</Tag>
              )
            }
          ]}
        />
      </Card>

      <Card size="small" title={t('profile.timeline')}>
        <Timeline
          items={player.timeline.map((entry) => ({
            children: `${date(entry.at)} · ${t(`timeline.${entry.kind}`)}${entry.detail ? ` — ${entry.detail}` : ''}`
          }))}
        />
      </Card>

      <Card size="small" title={t('profile.notes')}>
        <List
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
          dataSource={player.notes}
          renderItem={(note) => (
            <List.Item>
              <List.Item.Meta title={date(note.createdAt)} description={note.text} />
            </List.Item>
          )}
        />
        {hasPermission(role, 'players.notes') ? (
          <Form form={form} layout="inline" onFinish={submitNote} style={{ marginTop: 12 }}>
            <Form.Item name="text" rules={[{ required: true, max: 2000 }]} style={{ flex: 1 }}>
              <Input placeholder={t('profile.notePlaceholder')} maxLength={2000} />
            </Form.Item>
            <Button htmlType="submit" loading={isAdding}>
              {t('profile.addNote')}
            </Button>
          </Form>
        ) : null}
      </Card>
    </Space>
  )
}
