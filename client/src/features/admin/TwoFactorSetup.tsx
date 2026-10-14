'use client'

import { Alert, Button, Card, Form, Input, QRCode, Typography } from 'antd'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import type { ITwoFactorEnrollment } from '@lib/utils/admin'
import { useAdminConfirmMutation, useAdminEnrollMutation } from '../../shared/api'
import { useErrorMessage } from '../../shared/errors'
import { errorNotification } from '../../shared/notifications'

const failureOf = (error: unknown) => (error as { data?: { code?: string; error?: string } }).data

// Enrolls the authenticator app of an admin: the secret as a QR code, the first code, then the recovery codes (shown once)
export default function TwoFactorSetup({ onDone }: { onDone: () => void }) {
  const t = useTranslations('admin.twoFactor')
  const getErrorMessage = useErrorMessage()
  const [enroll, { isLoading: isEnrolling }] = useAdminEnrollMutation()
  const [confirm, { isLoading: isConfirming }] = useAdminConfirmMutation()
  const [enrollment, setEnrollment] = useState<ITwoFactorEnrollment | null>(null)
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null)

  const report = (error: unknown) => {
    const body = failureOf(error)
    errorNotification(getErrorMessage({ code: body?.code, message: body?.error }))
  }

  async function start() {
    const result = await enroll()

    if ('error' in result) {
      report(result.error)
      return
    }
    setEnrollment(result.data)
  }

  async function submit({ code }: { code: string }) {
    const result = await confirm({ twoFactorCodeDto: { code } })

    if ('error' in result) {
      report(result.error)
      return
    }
    setRecoveryCodes(result.data.recoveryCodes)
  }

  if (recoveryCodes) {
    return (
      <Card title={t('recoveryTitle')}>
        <Typography.Paragraph>{t('recoveryIntro')}</Typography.Paragraph>
        <Typography.Paragraph code data-testid="recovery-codes">
          {recoveryCodes.map((code) => (
            <div key={code}>{code}</div>
          ))}
        </Typography.Paragraph>
        <Button type="primary" onClick={onDone}>
          {t('recoverySaved')}
        </Button>
      </Card>
    )
  }

  return (
    <Card title={t('setupTitle')}>
      <Typography.Paragraph>{t('setupIntro')}</Typography.Paragraph>
      {enrollment ? (
        <>
          <Typography.Paragraph>{t('scan')}</Typography.Paragraph>
          <QRCode type="svg" value={enrollment.otpauthUrl} />
          <Alert type="info" message={<Typography.Text copyable>{enrollment.secret}</Typography.Text>} />
          <Form layout="inline" onFinish={submit} style={{ marginTop: 16 }}>
            <Form.Item name="code" rules={[{ required: true, pattern: /^\d{6}$/ }]}>
              <Input inputMode="numeric" autoComplete="one-time-code" placeholder={t('code')} />
            </Form.Item>
            <Button type="primary" htmlType="submit" loading={isConfirming}>
              {t('confirm')}
            </Button>
          </Form>
        </>
      ) : (
        <Button type="primary" onClick={start} loading={isEnrolling}>
          {t('start')}
        </Button>
      )}
    </Card>
  )
}
