'use client'

import { Alert, Button, Card, Empty, List, Segmented, Space, Table, Tag } from 'antd'
import Link from 'next/link'
import { useState } from 'react'
import { useFormatter, useTranslations } from 'next-intl'
import { hasPermission } from '@lib/utils/admin'
import {
  IFailedLoginGroup,
  SECURITY_THRESHOLDS,
  SECURITY_WINDOW_HOURS,
  SecurityWindowHours
} from '@lib/utils/admin-security'
import {
  useSecurityOverviewQuery,
  useSecurityRevokeKeyMutation,
  useSupervisionQuarantineMutation
} from '../../../shared/api'
import { useAdminMe } from '../admin-me-context'
import ActionModal, { ActionValues } from '../players/ActionModal'
import { useReportFailure } from '../use-report-failure'

type Pending = { type: 'revoke'; id: string } | { type: 'quarantine'; id: string }

// Where abuse shows first (design §25.3): failed sign-ins, shared addresses, locked bots, API keys, scripts the sandbox stopped, and
// the biggest consumers of ops. A ban is on the profile of the player; quarantine and revoking a key are here.
export default function SecurityPage() {
  const t = useTranslations('admin.security')
  const format = useFormatter()
  const { role } = useAdminMe()
  const report = useReportFailure()
  const [hours, setHours] = useState<SecurityWindowHours>(24)
  const [pending, setPending] = useState<Pending | null>(null)
  const { data, isError } = useSecurityOverviewQuery({ hours })
  const [revoke, revokeState] = useSecurityRevokeKeyMutation()
  const [quarantine, quarantineState] = useSupervisionQuarantineMutation()
  const date = (ms: number | null) =>
    ms === null ? '–' : format.dateTime(new Date(ms), { dateStyle: 'short', timeStyle: 'short' })
  const canRevoke = hasPermission(role, 'security.revoke-key')
  const canQuarantine = hasPermission(role, 'supervision.quarantine')

  if (isError) {
    return <Alert type="error" message={t('loadFailed')} />
  }

  async function submit({ reason }: ActionValues) {
    const result =
      pending?.type === 'revoke'
        ? await revoke({ id: pending.id, reasonDto: { reason } })
        : await quarantine({ id: (pending as Pending).id, reasonDto: { reason } })

    if (!report(result)) {
      setPending(null)
    }
  }

  const failures = (title: string, rows: IFailedLoginGroup[], isAddress: boolean) => (
    <Card size="small" title={title}>
      <Table
        size="small"
        rowKey="key"
        pagination={false}
        locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
        dataSource={rows}
        columns={[
          { title: isAddress ? t('address') : t('email'), dataIndex: 'key' },
          {
            title: t('failures'),
            dataIndex: 'failures',
            render: (count: number) => (
              <Tag color={count >= SECURITY_THRESHOLDS.failuresPerKey ? 'red' : 'default'}>{count}</Tag>
            )
          },
          ...(isAddress ? [{ title: t('emails'), dataIndex: 'distinctEmails' }] : []),
          { title: t('last'), dataIndex: 'lastAt', render: date }
        ]}
      />
    </Card>
  )

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Segmented
        value={hours}
        onChange={(value) => setHours(value as SecurityWindowHours)}
        options={SECURITY_WINDOW_HOURS.map((value) => ({ value, label: t('window', { hours: value }) }))}
      />

      {failures(t('failedByIp'), data?.failedLoginsByIp ?? [], true)}
      {failures(t('failedByEmail'), data?.failedLoginsByEmail ?? [], false)}

      <Card size="small" title={t('sameIp', { count: SECURITY_THRESHOLDS.accountsPerIp })}>
        <List
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
          dataSource={data?.sameIpAccounts ?? []}
          renderItem={(group) => (
            <List.Item>
              <Space wrap>
                <strong>{group.ip}</strong>
                {group.accounts.map((account) => (
                  <Link key={account._id} href={`/admin/players/${account._id}`}>
                    {account.name}
                  </Link>
                ))}
              </Space>
            </List.Item>
          )}
        />
      </Card>

      <Card size="small" title={t('multiIp', { count: SECURITY_THRESHOLDS.ipsPerAccount })}>
        <List
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
          dataSource={data?.multiIpAccounts ?? []}
          renderItem={(account) => (
            <List.Item>
              <Link href={`/admin/players/${account._id}`}>{account.name}</Link>
              <span>{t('addresses', { count: account.ips })}</span>
            </List.Item>
          )}
        />
      </Card>

      <Card size="small" title={t('lockouts')}>
        <List
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
          dataSource={data?.botLockouts ?? []}
          renderItem={(lockout) => (
            <List.Item>
              <Space wrap>
                <Link href={`/admin/inspector/${lockout.botId}`}>{lockout.label ?? lockout.botId}</Link>
                {lockout.ownerId ? <Link href={`/admin/players/${lockout.ownerId}`}>{lockout.ownerName}</Link> : null}
                <span>{t('lockedUntil', { time: date(lockout.lockedUntil), failures: lockout.failures })}</span>
              </Space>
            </List.Item>
          )}
        />
      </Card>

      <Card size="small" title={t('keys')}>
        <Table
          size="small"
          rowKey="_id"
          pagination={false}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
          dataSource={data?.apiKeys ?? []}
          columns={[
            { title: t('keyName'), render: (_, key) => `${key.name} (${key.prefix}…)` },
            {
              title: t('owner'),
              render: (_, key) => <Link href={`/admin/players/${key.owner._id}`}>{key.owner.name}</Link>
            },
            { title: t('scopes'), dataIndex: 'scopes', render: (scopes: string[]) => scopes.join(', ') },
            { title: t('rate'), dataIndex: 'ratePerMinute' },
            { title: t('lastUsed'), dataIndex: 'lastUsedAt', render: date },
            {
              title: t('limitHits'),
              dataIndex: 'rateLimitHits',
              render: (hits: number) => <Tag color={hits > 0 ? 'gold' : 'default'}>{hits}</Tag>
            },
            {
              title: '',
              render: (_, key) =>
                key.isRevoked ? (
                  <Tag>{t('revoked')}</Tag>
                ) : canRevoke ? (
                  <Button size="small" danger onClick={() => setPending({ type: 'revoke', id: key._id })}>
                    {t('revoke')}
                  </Button>
                ) : null
            }
          ]}
        />
      </Card>

      <Card size="small" title={t('scripts')}>
        <Table
          size="small"
          rowKey="executionId"
          pagination={false}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
          dataSource={data?.suspiciousScripts ?? []}
          columns={[
            { title: t('code'), dataIndex: 'code', render: (code: string) => <Tag color="red">{code}</Tag> },
            {
              title: t('owner'),
              render: (_, script) => <Link href={`/admin/players/${script.owner._id}`}>{script.owner.name}</Link>
            },
            {
              title: t('bot'),
              render: (_, script) => <Link href={`/admin/inspector/${script.botId}`}>{script.file}</Link>
            },
            { title: t('when'), dataIndex: 'endedAt', render: date },
            {
              title: '',
              render: (_, script) =>
                canQuarantine ? (
                  <Button size="small" onClick={() => setPending({ type: 'quarantine', id: script.owner._id })}>
                    {t('quarantine')}
                  </Button>
                ) : null
            }
          ]}
        />
      </Card>

      <Card size="small" title={t('consumers')}>
        {data?.topConsumers === null ? (
          <Alert type="warning" message={t('engineDown')} />
        ) : (
          <Table
            size="small"
            rowKey="executionId"
            pagination={false}
            locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
            dataSource={data?.topConsumers ?? []}
            columns={[
              { title: t('opsUsed'), dataIndex: 'opsUsed' },
              { title: t('ticks'), dataIndex: 'ticks' },
              {
                title: t('owner'),
                render: (_, usage) => <Link href={`/admin/players/${usage.userId}`}>{usage.userId.slice(0, 8)}</Link>
              },
              {
                title: t('bot'),
                render: (_, usage) => <Link href={`/admin/inspector/${usage.botId}`}>{usage.file}</Link>
              }
            ]}
          />
        )}
      </Card>

      {pending ? (
        <ActionModal
          title={t(pending.type === 'revoke' ? 'revokeTitle' : 'quarantineTitle')}
          isOpen
          isLoading={revokeState.isLoading || quarantineState.isLoading}
          onSubmit={submit}
          onCancel={() => setPending(null)}
        />
      ) : null}
    </Space>
  )
}
