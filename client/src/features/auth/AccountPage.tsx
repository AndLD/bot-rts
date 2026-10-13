'use client'

import { Button, Card, Form, Input, notification } from 'antd'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useErrorMessage } from '../../shared/errors'
import { errorNotification } from '../../shared/notifications'
import AchievementBadges from '../achievements/AchievementBadges'
import { LanguageSwitcher } from '../../shared/i18n/LanguageSwitcher'
import { useAuth } from './auth-client-context'
import { AuthResult } from './auth-client'
import { useLogout } from './hooks'
import { useAuthRules } from './validation'

// The player's account: password, email and deletion. Everything goes through the auth client.
export default function AccountPage() {
  const t = useTranslations('auth')
  const rules = useAuthRules()
  const getErrorMessage = useErrorMessage()
  const auth = useAuth()
  const logout = useLogout()

  function report(result: AuthResult, successMessage: string, reset: () => void) {
    if (result.ok) {
      notification.success({ message: successMessage })
      reset()
    } else {
      errorNotification(getErrorMessage(result.failure))
    }
  }

  const [passwordForm] = Form.useForm()
  const [emailForm] = Form.useForm()
  const [deleteForm] = Form.useForm()

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>{t('account.title')}</h1>
        <LanguageSwitcher />
      </div>

      <Card title={t('account.badges')}>
        <AchievementBadges />
      </Card>

      <Card title={t('account.password.title')}>
        <Form
          form={passwordForm}
          layout="vertical"
          onFinish={async ({ currentPassword, newPassword }) =>
            report(await auth.changePassword(currentPassword, newPassword), t('account.password.success'), () =>
              passwordForm.resetFields()
            )
          }
        >
          <Form.Item name="currentPassword" rules={[rules.passwordRequired]}>
            <Input.Password placeholder={t('fields.currentPassword')} />
          </Form.Item>
          <Form.Item name="newPassword" rules={[rules.passwordRequired, rules.password]}>
            <Input.Password placeholder={t('fields.newPassword')} />
          </Form.Item>
          <Button htmlType="submit" type="primary">
            {t('account.password.submit')}
          </Button>
        </Form>
      </Card>

      <Card title={t('account.email.title')}>
        <Form
          form={emailForm}
          layout="vertical"
          onFinish={async ({ password, newEmail }) =>
            report(await auth.requestEmailChange(password, newEmail), t('account.email.sent'), () =>
              emailForm.resetFields()
            )
          }
        >
          <Form.Item name="password" rules={[rules.passwordRequired]}>
            <Input.Password placeholder={t('fields.password')} />
          </Form.Item>
          <Form.Item name="newEmail" rules={[rules.emailRequired, rules.email]}>
            <Input type="email" placeholder={t('fields.newEmail')} />
          </Form.Item>
          <Button htmlType="submit" type="primary">
            {t('account.email.submit')}
          </Button>
        </Form>
      </Card>

      <Card title={t('account.delete.title')}>
        <p style={{ marginBottom: 16 }}>{t('account.delete.warning')}</p>
        <Form
          form={deleteForm}
          layout="vertical"
          onFinish={async ({ password }) =>
            report(await auth.requestAccountDeletion(password), t('account.delete.sent'), () =>
              deleteForm.resetFields()
            )
          }
        >
          <Form.Item name="password" rules={[rules.passwordRequired]}>
            <Input.Password placeholder={t('fields.password')} />
          </Form.Item>
          <Button htmlType="submit" danger>
            {t('account.delete.submit')}
          </Button>
        </Form>
      </Card>

      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <Link href="/game">{t('account.back')}</Link>
        <Button type="link" onClick={() => logout()}>
          {t('account.signOut')}
        </Button>
      </div>
    </div>
  )
}
