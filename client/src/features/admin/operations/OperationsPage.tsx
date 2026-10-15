'use client'

import { Alert, Button, Card, Descriptions, Form, Input, Space, Table, Tag } from 'antd'
import Link from 'next/link'
import { useState } from 'react'
import { useFormatter, useTranslations } from 'next-intl'
import { hasPermission } from '@lib/utils/admin'
import {
  ANNOUNCEMENT_MAX_LENGTH,
  BANNER_MAX_LENGTH,
  IAnnouncementResult,
  IRestartResult
} from '@lib/utils/admin-operations'
import {
  useOperationsAnnounceMutation,
  useOperationsClearBannerMutation,
  useOperationsRestartRuntimeMutation,
  useOperationsSetBannerMutation,
  useOperationsStatusQuery
} from '../../../shared/api'
import { useAdminMe } from '../admin-me-context'
import ActionModal, { ActionValues } from '../players/ActionModal'
import { useReportFailure } from '../use-report-failure'

const MINUTE_MS = 60_000
const HOUR_MS = 3_600_000
const MEGABYTE = 1024 * 1024

type Pending =
  | { type: 'announce'; text: string }
  | { type: 'banner'; message: string; startsAt: number; endsAt: number | null }
  | { type: 'clear' }
  | { type: 'restart' }

interface BannerForm {
  message: string
  startsAt: string
  endsAt?: string
}

// Operations (design §25.3): what runs, the background jobs and the last backup, announcements to the players, the banner of a
// scheduled maintenance, and the restart of the scripts. Pausing the world is on the Supervision page.
export default function OperationsPage() {
  const t = useTranslations('admin.operations')
  const format = useFormatter()
  const { role } = useAdminMe()
  const report = useReportFailure()
  const { data, isError } = useOperationsStatusQuery(undefined, { pollingInterval: 30_000 })
  const [announce, announceState] = useOperationsAnnounceMutation()
  const [setBanner, bannerState] = useOperationsSetBannerMutation()
  const [clearBanner, clearState] = useOperationsClearBannerMutation()
  const [restart, restartState] = useOperationsRestartRuntimeMutation()
  const [pending, setPending] = useState<Pending | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const canAnnounce = hasPermission(role, 'ops.announce')
  const canRestart = hasPermission(role, 'ops.restart-runtime')
  const date = (ms: number | null) =>
    ms === null ? '–' : format.dateTime(new Date(ms), { dateStyle: 'short', timeStyle: 'short' })

  if (isError) {
    return <Alert type="error" message={t('loadFailed')} />
  }
  if (!data) {
    return null
  }

  async function submit({ reason }: ActionValues) {
    const current = pending as Pending
    const result =
      current.type === 'announce'
        ? await announce({ announceDto: { text: current.text, reason } })
        : current.type === 'banner'
          ? await setBanner({
              maintenanceBannerDto: {
                message: current.message,
                startsAt: current.startsAt,
                endsAt: current.endsAt,
                reason
              }
            })
          : current.type === 'clear'
            ? await clearBanner({ reasonDto: { reason } })
            : await restart({ reasonDto: { reason } })

    if (report(result)) {
      return
    }
    const body = (result as { data: IAnnouncementResult & IRestartResult }).data
    setNotice(
      current.type === 'announce'
        ? t('announced', { count: body.recipients })
        : current.type === 'restart'
          ? t('restarted', { count: body.restarted, failed: body.failedBots })
          : null
    )
    setPending(null)
  }

  const { engine, backup } = data
  const uptimeMinutes = Math.floor(engine.uptimeMs / MINUTE_MS)

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      {notice ? <Alert type="success" message={notice} closable onClose={() => setNotice(null)} /> : null}

      <Card size="small" title={t('engine.title')}>
        <Descriptions size="small" column={{ xs: 1, md: 3 }}>
          <Descriptions.Item label={t('engine.status')}>
            <Tag color={engine.isResponding ? 'green' : 'red'}>
              {engine.isResponding ? t('engine.running') : t('engine.notResponding')}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label={t('engine.uptime')}>
            {t('engine.duration', { hours: Math.floor(uptimeMinutes / 60), minutes: uptimeMinutes % 60 })}
          </Descriptions.Item>
          <Descriptions.Item label={t('engine.tick')}>{engine.tick}</Descriptions.Item>
          <Descriptions.Item label={t('engine.lastTick')}>{engine.lastTickMs} ms</Descriptions.Item>
          <Descriptions.Item label={t('engine.p95Tick')}>{engine.p95TickMs} ms</Descriptions.Item>
          <Descriptions.Item label={t('engine.executions')}>{engine.executions}</Descriptions.Item>
          <Descriptions.Item label={t('engine.memory')}>
            {Math.round(engine.memoryBytes / MEGABYTE)} MB
          </Descriptions.Item>
          <Descriptions.Item label={t('engine.world')}>
            {data.isPaused ? <Tag color="red">{t('engine.paused')}</Tag> : null}
            {data.areScriptsHalted ? <Tag color="red">{t('engine.halted')}</Tag> : null}
            {!data.isPaused && !data.areScriptsHalted ? <Tag color="green">{t('engine.normal')}</Tag> : null}{' '}
            <Link href="/admin/supervision">{t('engine.supervision')}</Link>
          </Descriptions.Item>
        </Descriptions>
        {canRestart ? (
          <Button danger onClick={() => setPending({ type: 'restart' })}>
            {t('engine.restart')}
          </Button>
        ) : null}
      </Card>

      <Card size="small" title={t('jobs.title')}>
        <Table
          size="small"
          rowKey="name"
          pagination={false}
          locale={{ emptyText: t('jobs.none') }}
          dataSource={data.jobs}
          columns={[
            { title: t('jobs.name'), dataIndex: 'name' },
            { title: t('jobs.lastRun'), dataIndex: 'lastRunAt', render: date },
            {
              title: t('jobs.failures'),
              dataIndex: 'failures',
              render: (failures: number) => <Tag color={failures > 0 ? 'red' : 'default'}>{failures}</Tag>
            },
            {
              title: t('jobs.totals'),
              dataIndex: 'totals',
              render: (totals: Record<string, number>) =>
                Object.entries(totals)
                  .filter(([, count]) => count > 0)
                  .map(([name, count]) => `${name}: ${count}`)
                  .join(', ') || '–'
            }
          ]}
        />
      </Card>

      <Card size="small" title={t('backup.title')}>
        {!backup.isConfigured ? (
          <Alert type="info" message={t('backup.notConfigured')} />
        ) : backup.finishedAt === null ? (
          <Alert type="warning" message={t('backup.notReported')} />
        ) : (
          <Descriptions size="small" column={{ xs: 1, md: 3 }}>
            <Descriptions.Item label={t('backup.finishedAt')}>{date(backup.finishedAt)}</Descriptions.Item>
            <Descriptions.Item label={t('backup.age')}>
              {t('backup.hours', { hours: Math.floor((Date.now() - backup.finishedAt) / HOUR_MS) })}
            </Descriptions.Item>
            <Descriptions.Item label={t('backup.size')}>
              {backup.sizeBytes === null ? '–' : `${Math.round(backup.sizeBytes / MEGABYTE)} MB`}
            </Descriptions.Item>
            <Descriptions.Item label={t('backup.location')}>{backup.location ?? '–'}</Descriptions.Item>
          </Descriptions>
        )}
      </Card>

      {canAnnounce ? (
        <>
          <Card size="small" title={t('announce.title')}>
            <Form layout="vertical" onFinish={({ text }: { text: string }) => setPending({ type: 'announce', text })}>
              <Form.Item
                name="text"
                label={t('announce.text')}
                rules={[{ required: true, max: ANNOUNCEMENT_MAX_LENGTH }]}
              >
                <Input.TextArea rows={3} maxLength={ANNOUNCEMENT_MAX_LENGTH} />
              </Form.Item>
              <Button type="primary" htmlType="submit">
                {t('announce.send')}
              </Button>
            </Form>
          </Card>

          <Card size="small" title={t('banner.title')}>
            {data.banner ? (
              <Alert
                type="warning"
                style={{ marginBottom: 12 }}
                message={data.banner.message}
                description={t('banner.current', { start: date(data.banner.startsAt), end: date(data.banner.endsAt) })}
                action={
                  <Button size="small" onClick={() => setPending({ type: 'clear' })}>
                    {t('banner.clear')}
                  </Button>
                }
              />
            ) : null}
            <Form
              layout="vertical"
              onFinish={({ message, startsAt, endsAt }: BannerForm) =>
                setPending({
                  type: 'banner',
                  message,
                  startsAt: new Date(startsAt).getTime(),
                  endsAt: endsAt ? new Date(endsAt).getTime() : null
                })
              }
            >
              <Form.Item
                name="message"
                label={t('banner.message')}
                rules={[{ required: true, max: BANNER_MAX_LENGTH }]}
              >
                <Input maxLength={BANNER_MAX_LENGTH} />
              </Form.Item>
              <Form.Item name="startsAt" label={t('banner.startsAt')} rules={[{ required: true }]}>
                <Input type="datetime-local" />
              </Form.Item>
              <Form.Item name="endsAt" label={t('banner.endsAt')}>
                <Input type="datetime-local" />
              </Form.Item>
              <Button type="primary" htmlType="submit">
                {t('banner.set')}
              </Button>
            </Form>
          </Card>
        </>
      ) : null}

      <ActionModal
        title={
          pending?.type === 'announce'
            ? t('announce.confirm')
            : pending?.type === 'banner'
              ? t('banner.confirm')
              : pending?.type === 'clear'
                ? t('banner.confirmClear')
                : t('engine.confirmRestart')
        }
        isOpen={pending !== null}
        isLoading={announceState.isLoading || bannerState.isLoading || clearState.isLoading || restartState.isLoading}
        onSubmit={submit}
        onCancel={() => setPending(null)}
      >
        {pending?.type === 'restart' ? <p>{t('engine.restartHelp')}</p> : null}
      </ActionModal>
    </Space>
  )
}
