'use client'

import { Table, Tag } from 'antd'
import { useTranslations } from 'next-intl'
import reference from './generated/admin-reference.json'

// The roles each permission is held by, from the code (lib/utils/admin.ts)
export function PermissionsTable() {
  const t = useTranslations('adminDocs.parts')

  return (
    <Table
      size="small"
      rowKey="permission"
      pagination={false}
      dataSource={reference.permissions}
      columns={[
        { title: t('permission'), dataIndex: 'permission' },
        ...reference.roles.map((role) => ({
          title: t(`roles.${role}`),
          key: role,
          render: (_: unknown, row: { roles: string[] }) =>
            row.roles.includes(role) ? <Tag color="green">✓</Tag> : '–'
        }))
      ]}
    />
  )
}

// The actions written to the audit log, from the code
export function AuditActionsList() {
  return (
    <ul>
      {reference.auditActions.map((action) => (
        <li key={action}>
          <code>{action}</code>
        </li>
      ))}
    </ul>
  )
}

// When the dashboard turns yellow or red, from the defaults of the monitoring
export function AlertsTable() {
  const t = useTranslations('adminDocs.parts')

  return (
    <Table
      size="small"
      rowKey="metric"
      pagination={false}
      dataSource={reference.alerts as Array<{ metric: string; direction: string; yellow?: number; red?: number }>}
      columns={[
        { title: t('metric'), dataIndex: 'metric' },
        { title: t('direction'), dataIndex: 'direction', render: (direction: string) => t(`directions.${direction}`) },
        { title: t('yellow'), dataIndex: 'yellow', render: (value?: number) => value ?? '–' },
        { title: t('red'), dataIndex: 'red', render: (value?: number) => value ?? '–' }
      ]}
    />
  )
}
