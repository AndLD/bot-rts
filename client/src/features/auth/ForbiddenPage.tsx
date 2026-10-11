'use client'

import { MailOutlined } from '@ant-design/icons'
import { Button, Form, Input, notification } from 'antd'
import { useTranslations } from 'next-intl'
import { useErrorMessage } from '../../shared/errors'
import { errorNotification } from '../../shared/notifications'
import { useAuth } from './auth-client-context'
import { useAuthRules } from './validation'

export default function ForbiddenPage() {
  const t = useTranslations('auth')
  const rules = useAuthRules()
  const getErrorMessage = useErrorMessage()
  const auth = useAuth()

  async function onFinish({ email }: { email: string }) {
    const result = await auth.resendVerification(email)

    if (result.ok) {
      notification.success({ message: t('forbidden.resent') })
    } else {
      errorNotification(getErrorMessage(result.failure))
    }
  }

  return (
    <div
      style={{
        fontSize: 45,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        flexDirection: 'column',
        gap: 50
      }}
    >
      <MailOutlined style={{ fontSize: 100 }} />
      <div>{t('forbidden.message')}</div>
      <Form layout="inline" onFinish={onFinish} style={{ fontSize: 16 }}>
        <Form.Item name="email" rules={[rules.emailRequired, rules.email]}>
          <Input type="email" placeholder={t('fields.email')} />
        </Form.Item>
        <Button htmlType="submit">{t('forbidden.resend')}</Button>
      </Form>
    </div>
  )
}
