import { Button, Form, Input } from 'antd'
import { useAppDispatch } from '../../hooks/store'
import { appSlice } from '../../store/app.reducer'
import { IUserPostBody } from '@lib/utils/interfaces/users'
import { errorNotification } from '../../utils/notifications'
import { validationRules } from '../../utils/validation'
import { useNavigate } from 'react-router-dom'
import { usePostUserMutation } from '../../store/users.api'

export default function SignupForm() {
  const navigate = useNavigate()
  const [form] = Form.useForm()
  const dispatch = useAppDispatch()
  const [postUser] = usePostUserMutation()

  function onFinish(user: IUserPostBody) {
    postUser(user).then((value: any) => {
      if (value.data) {
        const token = value.data.accessToken
        dispatch(appSlice.actions.setToken(token))

        navigate('/forbidden')
      } else {
        // TODO: Handle validation errors
        const error = value.error?.msg || value.error?.data?.error
        errorNotification(
          value.error?.originalStatus === 503 ? 'Реєстрація недоступна' : error,
          'Не вдалося зареєструватися'
        )
      }
    })
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
