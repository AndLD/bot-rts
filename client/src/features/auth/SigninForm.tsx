'use client'

import { Button, Form, Input } from 'antd'
import { useAppDispatch } from '../../shared/store/hooks'
import { setToken } from '../../shared/store/session.slice'
import { useLoginMutation } from './auth.api'
import { IAuthPostBody } from '@lib/utils/interfaces/auth'
import { errorNotification } from '../../shared/notifications'
import { getErrorMessage } from '../../shared/errors'
import { validationRules } from '../../shared/validation'

export default function SigninForm() {
  const [form] = Form.useForm()
  const dispatch = useAppDispatch()
  const [login] = useLoginMutation()

  async function onFinish(credentials: IAuthPostBody) {
    const result = await login(credentials)

    if (result.data) {
      dispatch(setToken(result.data.accessToken))
    } else {
      errorNotification(getErrorMessage(result.error), 'Login error')
    }
  }

  return (
    <Form form={form} name="basic" onFinish={onFinish} autoComplete="off" className="auth-form">
      <Form.Item name="email" rules={[validationRules.REQUIRED('Please enter your email!'), validationRules.EMAIL()]}>
        <Input type="email" placeholder="Email" />
      </Form.Item>

      <Form.Item
        name="password"
        rules={[validationRules.REQUIRED('Please enter your password!'), validationRules.PASSWORD()]}
      >
        <Input.Password placeholder="Password" />
      </Form.Item>

      <div className="button">
        <Button className="button" htmlType="submit" type="primary">
          Log in
        </Button>
      </div>
    </Form>
  )
}
