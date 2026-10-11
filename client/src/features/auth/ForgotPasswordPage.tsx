'use client'

import { Button, Form, Input } from 'antd'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { useErrorMessage } from '../../shared/errors'
import { errorNotification } from '../../shared/notifications'
import { LanguageSwitcher } from '../../shared/i18n/LanguageSwitcher'
import { useAuth } from './auth-client-context'
import './AuthPage.scss'
import { useAuthRules } from './validation'

export default function ForgotPasswordPage() {
  const t = useTranslations('auth')
  const rules = useAuthRules()
  const getErrorMessage = useErrorMessage()
  const auth = useAuth()
  const [isSent, setIsSent] = useState(false)

  async function onFinish({ email }: { email: string }) {
    const result = await auth.requestPasswordReset(email)

    if (result.ok) {
      setIsSent(true)
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
        <h1>{t('forgot.title')}</h1>
        {isSent ? (
          <p>{t('forgot.sent')}</p>
        ) : (
          <Form name="forgot" onFinish={onFinish} autoComplete="off" className="auth-form">
            <p>{t('forgot.description')}</p>
            <Form.Item name="email" rules={[rules.emailRequired, rules.email]}>
              <Input type="email" placeholder={t('fields.email')} />
            </Form.Item>
            <div className="button">
              <Button className="button" htmlType="submit" type="primary">
                {t('forgot.submit')}
              </Button>
            </div>
          </Form>
        )}
        <Link href="/auth" className="auth-link">
          {t('forgot.back')}
        </Link>
      </div>
    </div>
  )
}
