'use client'

import { Button, Form, Input } from 'antd'
import { IAuthPostBody } from '@lib/utils/interfaces/auth'
import { useTranslations } from 'next-intl'
import { errorNotification } from '../../shared/notifications'
import { useErrorMessage } from '../../shared/errors'
import { useAppDispatch } from '../../shared/store/hooks'
import { setToken } from '../../shared/store/session.slice'
import { useLoginMutation } from './auth.api'
import { useAuthRules } from './validation'

export default function SigninForm() {
  const t = useTranslations('auth')
  const rules = useAuthRules()
  const getErrorMessage = useErrorMessage()
  const [form] = Form.useForm()
  const dispatch = useAppDispatch()
  const [login] = useLoginMutation()

  async function onFinish(credentials: IAuthPostBody) {
    const result = await login(credentials)

    if (result.data) {
      dispatch(setToken(result.data.accessToken))
    } else {
      errorNotification(getErrorMessage(result.error), t('login.failed'))
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

      <div className="button">
        <Button className="button" htmlType="submit" type="primary">
          {t('login.submit')}
        </Button>
      </div>
    </Form>
  )
}
