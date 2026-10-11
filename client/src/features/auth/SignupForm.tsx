'use client'

import { Button, Form, Input } from 'antd'
import { useAppDispatch } from '../../shared/store/hooks'
import { setToken } from '../../shared/store/session.slice'
import { IUserPostBody } from '@lib/utils/interfaces/users'
import { errorNotification } from '../../shared/notifications'
import { getErrorMessage } from '../../shared/errors'
import { validationRules } from '../../shared/validation'
import { useRouter } from 'next/navigation'
import { useRegisterMutation } from './auth.api'

export default function SignupForm() {
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
      errorNotification(getErrorMessage(result.error), 'Could not sign up')
    }
  }

  return (
    <Form form={form} name="basic" onFinish={onFinish} autoComplete="off" className="auth-form">
      <Form.Item
        name="name"
        rules={[
          validationRules.REQUIRED('Будь-ласка введіть ваше ім`я та прізвище!'),
          validationRules.NAME('Невірні ім`я та прізвище!')
        ]}
      >
        <Input placeholder="Name" />
      </Form.Item>

      <Form.Item
        name="email"
        rules={[validationRules.EMAIL('Невірний email'), validationRules.REQUIRED('Будь-ласка введіть ваш email!')]}
      >
        <Input type="email" placeholder="Email" />
      </Form.Item>

      <Form.Item
        name="password"
        rules={[
          validationRules.REQUIRED('Будь-ласка введіть ваш пароль!'),
          validationRules.PASSWORD(
            'Пароль має містити 6-20 символів, хочаб одну цифру, велику та маленьку літери латинського алфавіту та спеціальний символ: -#$.%&@(){}[]!?+*'
          )
        ]}
      >
        <Input.Password placeholder="Password" />
      </Form.Item>

      <div className="button">
        <Button className="button" htmlType="submit" type="primary">
          Sign up
        </Button>
      </div>
    </Form>
  )
}
