'use client'

import { Alert, Button, Layout, Menu, Space, Spin, Tag } from 'antd'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { ReactNode, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { hasPermission } from '@lib/utils/admin'
import { useAdminMeQuery } from '../../shared/api'
import { useLogout } from '../auth/hooks'
import { ADMIN_NAV } from './admin-nav'
import { AdminMeContext } from './admin-me-context'
import TwoFactorPrompt from './TwoFactorPrompt'
import TwoFactorSetup from './TwoFactorSetup'

const FORBIDDEN = 403

// The frame of the console. Anyone who is not an admin goes back to the game; an admin sees the pages only once the second
// factor is set up and verified for this session. What the menu shows depends on the permissions of the role.
export default function AdminShell({ children }: { children: ReactNode }) {
  const t = useTranslations('admin')
  const router = useRouter()
  const pathname = usePathname()
  const logout = useLogout()
  const { data: me, error, isLoading, refetch } = useAdminMeQuery()
  const isNotAdmin = (error as { status?: number } | undefined)?.status === FORBIDDEN

  useEffect(() => {
    if (isNotAdmin) {
      router.replace('/game')
    }
  }, [isNotAdmin, router])

  if (isLoading || isNotAdmin) {
    return <Spin fullscreen tip={t('loading')} />
  }
  if (!me) {
    return <Alert type="error" message={t('loadFailed')} />
  }
  if (!me.twoFactor.isEnrolled) {
    return <TwoFactorSetup onDone={refetch} />
  }
  if (!me.twoFactor.isVerified) {
    return <TwoFactorPrompt />
  }

  const items = ADMIN_NAV.filter((item) => !item.permission || hasPermission(me.role, item.permission)).map((item) => ({
    key: item.path,
    label: <Link href={item.path}>{t(`nav.${item.labelKey}`)}</Link>
  }))

  return (
    <AdminMeContext.Provider value={me}>
      <Layout style={{ minHeight: '100vh' }}>
        <Layout.Sider breakpoint="lg" collapsedWidth={0}>
          <Menu theme="dark" mode="inline" selectedKeys={[pathname]} items={items} />
        </Layout.Sider>
        <Layout>
          <Layout.Header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'white' }}>{t('title')}</span>
            <Space>
              <Tag>{t(`roles.${me.role}`)}</Tag>
              <Link href="/game">{t('backToGame')}</Link>
              <Button onClick={() => logout(() => router.replace('/auth'))}>{t('signOut')}</Button>
            </Space>
          </Layout.Header>
          <Layout.Content style={{ padding: 24 }}>{children}</Layout.Content>
        </Layout>
      </Layout>
    </AdminMeContext.Provider>
  )
}
