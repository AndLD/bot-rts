'use client'

import { Alert, Card, Descriptions, Empty, List, Space, Spin, Table, Tabs, Tag } from 'antd'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useFormatter, useTranslations } from 'next-intl'
import { useInspectorBotQuery } from '../../../shared/api'
import FileBrowser from './FileBrowser'

// One base or bot, as the server has it (design §25.3): read-only
export default function BotInspectorPage() {
  const t = useTranslations('admin.inspector')
  const format = useFormatter()
  const { id } = useParams<{ id: string }>()
  const { data: bot, isLoading, isError } = useInspectorBotQuery({ id })
  const date = (ms: number) => format.dateTime(new Date(ms), { dateStyle: 'medium', timeStyle: 'medium' })

  if (isLoading) {
    return <Spin />
  }
  if (isError || !bot) {
    return <Alert type="error" message={t('loadFailed')} />
  }

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Link href="/admin/inspector">{t('back')}</Link>
      <Card title={bot.label ?? bot._id} extra={<Tag>{t(`kind.${bot.type}`)}</Tag>}>
        <Descriptions column={{ xs: 1, md: 2 }}>
          <Descriptions.Item label={t('owner')}>
            {bot.ownerId ? <Link href={`/admin/players/${bot.ownerId}`}>{bot.ownerName}</Link> : '–'}
          </Descriptions.Item>
          <Descriptions.Item label={t('position')}>
            {bot.position ? (
              <Link
                href={`/admin/map?x=${bot.position.x}&y=${bot.position.y}`}
              >{`(${bot.position.x}, ${bot.position.y})`}</Link>
            ) : (
              t('noPosition')
            )}
          </Descriptions.Item>
          <Descriptions.Item
            label={t('energy')}
          >{`${Math.round(bot.energy.stored)} / ${Math.round(bot.energy.capacity)}`}</Descriptions.Item>
          <Descriptions.Item label={t('storage')}>
            {bot.storage.length ? bot.storage.map((stack) => `${stack.resource}: ${stack.amount}`).join(', ') : '–'}
          </Descriptions.Item>
          {bot.baseId ? (
            <Descriptions.Item label={t('base')}>
              <Link href={`/admin/inspector/${bot.baseId}`}>{bot.baseId}</Link>
            </Descriptions.Item>
          ) : null}
        </Descriptions>
      </Card>

      <Tabs
        items={[
          {
            key: 'modules',
            label: t('modules'),
            children: (
              <Table
                size="small"
                rowKey="_id"
                pagination={false}
                dataSource={bot.modules}
                columns={[
                  { title: t('columns.type'), dataIndex: 'type' },
                  { title: t('columns.name'), dataIndex: 'name' },
                  {
                    title: t('columns.condition'),
                    render: (_, module) => `${Math.round(module.condition)} / ${Math.round(module.maxCondition)}`
                  },
                  { title: t('columns.weight'), dataIndex: 'weight' },
                  {
                    title: t('columns.props'),
                    dataIndex: 'props',
                    render: (props: Record<string, string>) => (
                      <code>
                        {Object.entries(props)
                          .map(([key, value]) => `${key}=${value}`)
                          .join(' ')}
                      </code>
                    )
                  }
                ]}
              />
            )
          },
          {
            key: 'executions',
            label: t('executions'),
            children: (
              <Table
                size="small"
                rowKey="_id"
                pagination={false}
                locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
                dataSource={bot.executions}
                columns={[
                  { title: t('columns.file'), dataIndex: 'file' },
                  { title: t('columns.status'), dataIndex: 'status' },
                  { title: t('columns.restarts'), dataIndex: 'restarts' },
                  { title: t('columns.reason'), dataIndex: 'reason', render: (value: string | null) => value ?? '–' },
                  { title: t('columns.started'), dataIndex: 'createdAt', render: date }
                ]}
              />
            )
          },
          {
            key: 'logs',
            label: t('logs'),
            children: (
              <List
                size="small"
                locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
                dataSource={bot.logs}
                renderItem={(line) => (
                  <List.Item>
                    <code>{`${date(line.at)} [${line.kind}] ${line.text}`}</code>
                  </List.Item>
                )}
              />
            )
          },
          {
            key: 'files',
            label: t('drives'),
            children: bot.drives.length ? (
              <Tabs
                size="small"
                items={bot.drives.map((drive) => ({
                  key: drive._id,
                  label: `${drive.name} (${drive.usedBytes} / ${drive.quota})`,
                  children: <FileBrowser botId={bot._id} driveId={drive._id} />
                }))}
              />
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />
            )
          }
        ]}
      />
    </Space>
  )
}
