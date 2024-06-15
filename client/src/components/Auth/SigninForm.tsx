import { Button, Form, Input } from 'antd'
import { useAppDispatch } from '../../hooks/store'
import { useLoginMutation } from '../../store/auth.api'
import { appSlice } from '../../store/app.reducer'
import { IAuthPostBody } from '../../utils/interfaces/auth'
import { errorNotification } from '../../utils/notifications'
import { validationRules } from '../../utils/validation'

export default function SigninForm() {
    const [form] = Form.useForm()
    const dispatch = useAppDispatch()
    const [login] = useLoginMutation()

    function onFinish(user: IAuthPostBody) {
        login(user).then((value: any) => {
            if (value.data) {
                const token = value.data.result
                dispatch(appSlice.actions.setToken(token))
            } else {
                const error = value.error?.msg || value.error?.data?.error
                errorNotification(error, 'Login error')
            }
        })
    }

    return (
        <Form form={form} name="basic" onFinish={onFinish} autoComplete="off" className="auth-form">
            <Form.Item
                name="email"
                rules={[
                    validationRules.REQUIRED('Please enter your email!'),
                    validationRules.EMAIL()
                ]}
            >
                <Input type="email" placeholder="Email" />
            </Form.Item>

            <Form.Item
                name="password"
                rules={[
                    validationRules.REQUIRED('Please enter your password!'),
                    validationRules.PASSWORD()
                ]}
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
