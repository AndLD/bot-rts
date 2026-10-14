'use client'

import { Button, Card, Form, Input, Typography } from 'antd'
import { useTranslations } from 'next-intl'
import { useAdminVerifyMutation } from '../../shared/api'
import { useErrorMessage } from '../../shared/errors'
import { errorNotification } from '../../shared/notifications'

// Asks for the authenticator code (or a recovery code) once per session; a verified session refreshes the admin state
export default function TwoFactorPrompt() {
  const t = useTranslations('admin.twoFactor')
  const getErrorMessage = useErrorMessage()
  const [verify, { isLoading }] = useAdminVerifyMutation()

  async function submit({ code }: { code: string }) {
    const result = await verify({ twoFactorCodeDto: { code: code.trim() } })

    if ('error' in result) {
      const body = (result.error as { data?: { code?: string; error?: string } }).data
      errorNotification(getErrorMessage({ code: body?.code, message: body?.error }))
    }
  }

  return (
    <Card title={t('promptTitle')}>
      <Typography.Paragraph>{t('promptIntro')}</Typography.Paragraph>
      <Form layout="inline" onFinish={submit}>
        <Form.Item name="code" rules={[{ required: true, min: 6, max: 16 }]}>
          <Input autoComplete="one-time-code" placeholder={t('codeOrRecovery')} />
        </Form.Item>
        <Button type="primary" htmlType="submit" loading={isLoading}>
          {t('verify')}
        </Button>
      </Form>
    </Card>
  )
}
