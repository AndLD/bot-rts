'use client'

import { Button, Checkbox, Form, Input } from 'antd'
import { PRIVACY_POLICY_VERSION } from '@lib/utils/privacy'
import Link from 'next/link'
import { IUserPostBody } from '@lib/utils/interfaces/users'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { errorNotification } from '../../shared/notifications'
import { useErrorMessage } from '../../shared/errors'
import { useLocaleState } from '../../shared/i18n/I18nProvider'
import { localePath } from '../../site/config'
import { useAuth } from './auth-client-context'
import { useAuthRules } from './validation'

export default function SignupForm() {
  const t = useTranslations('auth')
  const rules = useAuthRules()
  const getErrorMessage = useErrorMessage()
  const router = useRouter()
  const [form] = Form.useForm()
  const auth = useAuth()
  const { locale } = useLocaleState()

  async function onFinish({ name, email, password }: Omit<IUserPostBody, 'acceptedPrivacyVersion'>) {
    const result = await auth.signUp({ name, email, password, acceptedPrivacyVersion: PRIVACY_POLICY_VERSION })

    if (result.ok) {
      router.push('/forbidden')
    } else {
      errorNotification(getErrorMessage(result.failure), t('signup.failed'))
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

      <Form.Item name="acceptPrivacy" valuePropName="checked" rules={[rules.privacyRequired]}>
        <Checkbox>
          {t.rich('signup.accept', {
            link: (chunks) => (
              <Link href={localePath(locale, '/privacy')} target="_blank">
                {chunks}
              </Link>
            )
          })}
        </Checkbox>
      </Form.Item>

      <div className="button">
        <Button className="button" htmlType="submit" type="primary">
          {t('signup.submit')}
        </Button>
      </div>
    </Form>
  )
}
