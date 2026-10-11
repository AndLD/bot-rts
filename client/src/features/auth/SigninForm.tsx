'use client'

import { Button, Form, Input } from 'antd'
import { IAuthPostBody } from '@lib/utils/interfaces/auth'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { errorNotification } from '../../shared/notifications'
import { useErrorMessage } from '../../shared/errors'
import { useAuth } from './auth-client-context'
import { useAuthRules } from './validation'

export default function SigninForm() {
  const t = useTranslations('auth')
  const rules = useAuthRules()
  const getErrorMessage = useErrorMessage()
  const [form] = Form.useForm()
  const auth = useAuth()

  async function onFinish(credentials: IAuthPostBody) {
    const result = await auth.signIn(credentials)

    if (!result.ok) {
      errorNotification(getErrorMessage(result.failure), t('login.failed'))
    }
  }

  return (
    <Form form={form} name="basic" onFinish={onFinish} autoComplete="off" className="auth-form">
      <Form.Item name="email" rules={[rules.emailRequired, rules.email]}>
        <Input type="email" placeholder={t('fields.email')} />
      </Form.Item>

      <Form.Item name="password" rules={[rules.passwordRequired, rules.password]}>
        <Input.Password placeholder={t('fields.password')} />
      </Form.Item>

      <Link href="/forgot-password" className="auth-link">
        {t('login.forgot')}
      </Link>

      <div className="button">
        <Button className="button" htmlType="submit" type="primary">
          {t('login.submit')}
        </Button>
      </div>
    </Form>
  )
}
