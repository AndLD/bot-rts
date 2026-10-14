'use client'

import { Tabs } from 'antd'
import { useTranslations } from 'next-intl'
import { hasPermission } from '@lib/utils/admin'
import { useAdminMe } from '../admin-me-context'
import AuditViewer from './AuditViewer'
import LogSearch from './LogSearch'
import SlowTicks from './SlowTicks'

// Logs, slow-tick traces and the audit trail (design §25.3); each tab is for the role that holds its permission
export default function LogsPage() {
  const t = useTranslations('admin.logs')
  const { role } = useAdminMe()
  const items = [
    ...(hasPermission(role, 'audit.read') ? [{ key: 'audit', label: t('tabs.audit'), children: <AuditViewer /> }] : []),
    ...(hasPermission(role, 'logs.read')
      ? [
          { key: 'logs', label: t('tabs.logs'), children: <LogSearch /> },
          { key: 'slow', label: t('tabs.slow'), children: <SlowTicks /> }
        ]
      : [])
  ]

  return <Tabs items={items} />
}
