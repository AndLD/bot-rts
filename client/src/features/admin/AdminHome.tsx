'use client'

import { Card, Descriptions } from 'antd'
import { useTranslations } from 'next-intl'
import { useAdminMe } from './admin-me-context'

// The landing page of the console; the dashboard of task 9.3 takes its place
export default function AdminHome() {
  const t = useTranslations('admin')
  const { role, permissions } = useAdminMe()

  return (
    <Card title={t('home.welcome')}>
      <Descriptions column={1}>
        <Descriptions.Item label={t('home.role')}>{t(`roles.${role}`)}</Descriptions.Item>
        <Descriptions.Item label={t('home.permissions', { count: permissions.length })}>
          {permissions.join(', ')}
        </Descriptions.Item>
      </Descriptions>
    </Card>
  )
}
