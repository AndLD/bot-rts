'use client'

import { Button, Form, Input } from 'antd'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { useErrorMessage } from '../../shared/errors'
import { errorNotification } from '../../shared/notifications'
import { LanguageSwitcher } from '../../shared/i18n/LanguageSwitcher'
import { useAuth } from './auth-client-context'
import './AuthPage.scss'
import { useAuthRules } from './validation'

export default function ResetPasswordPage() {
  const t = useTranslations('auth')
  const rules = useAuthRules()
  const getErrorMessage = useErrorMessage()
  const auth = useAuth()
  const token = useSearchParams().get('token')
  const [isDone, setIsDone] = useState(false)

  async function onFinish({ password }: { password: string }) {
    const result = await auth.resetPassword(token ?? '', password)

    if (result.ok) {
      setIsDone(true)
    } else {
      errorNotification(getErrorMessage(result.failure))
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-language">
        <LanguageSwitcher />
      </div>
      <div className="auth-card">
        <h1>{t('reset.title')}</h1>
        {!token ? (
          <p>{t('reset.missingToken')}</p>
        ) : isDone ? (
          <p>{t('reset.success')}</p>
        ) : (
          <Form name="reset" onFinish={onFinish} autoComplete="off" className="auth-form">
            <Form.Item name="password" rules={[rules.passwordRequired, rules.password]}>
              <Input.Password placeholder={t('fields.newPassword')} />
            </Form.Item>
            <div className="button">
              <Button className="button" htmlType="submit" type="primary">
                {t('reset.submit')}
              </Button>
            </div>
          </Form>
        )}
        <Link href="/auth" className="auth-link">
          {t('confirm.toLogin')}
        </Link>
      </div>
    </div>
  )
}
