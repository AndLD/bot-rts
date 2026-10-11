'use client'

import { Button, Form, Input } from 'antd'
import { IUserPostBody } from '@lib/utils/interfaces/users'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { errorNotification } from '../../shared/notifications'
import { useErrorMessage } from '../../shared/errors'
import { useAppDispatch } from '../../shared/store/hooks'
import { setToken } from '../../shared/store/session.slice'
import { useRegisterMutation } from './auth.api'
import { useAuthRules } from './validation'

export default function SignupForm() {
  const t = useTranslations('auth')
  const rules = useAuthRules()
  const getErrorMessage = useErrorMessage()
  const router = useRouter()
  const [form] = Form.useForm()
  const dispatch = useAppDispatch()
  const [register] = useRegisterMutation()

  async function onFinish(user: IUserPostBody) {
    const result = await register(user)

    if (result.data) {
      dispatch(setToken(result.data.accessToken))
      router.push('/forbidden')
    } else {
      errorNotification(getErrorMessage(result.error), t('signup.failed'))
    }
  }

  return (
    <Form form={form} name="basic" onFinish={onFinish} autoComplete="off" className="auth-form">
      <Form.Item name="name" rules={[rules.nameRequired, rules.name]}>
        <Input placeholder={t('fields.name')} />
      </Form.Item>

      <Form.Item name="email" rules={[rules.email, rules.emailRequired]}>
        <Input type="email" placeholder={t('fields.email')} />
      </Form.Item>

      <Form.Item name="password" rules={[rules.passwordRequired, rules.password]}>
        <Input.Password placeholder={t('fields.password')} />
      </Form.Item>

      <div className="button">
        <Button className="button" htmlType="submit" type="primary">
          {t('signup.submit')}
        </Button>
      </div>
    </Form>
  )
}
