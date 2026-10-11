'use client'

import { BOT_PASSWORD_MAX_LENGTH, BOT_PASSWORD_MIN_LENGTH, SPAWN_SEED_PATTERN } from '@lib/utils/validation'
import { Button, Form, Input, Modal } from 'antd'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { useErrorMessage } from '../../shared/errors'
import { errorNotification } from '../../shared/notifications'
import { useBotsDeployBaseMutation } from '../../shared/api'

interface DeployForm {
  password: string
  confirmation: string
  spawnSeed?: string
}

// The first thing a new player sees: set the access password of the base, confirm, and the base is deployed
export default function DeployBase() {
  const t = useTranslations('game.deploy')
  const getErrorMessage = useErrorMessage()
  const [form] = Form.useForm<DeployForm>()
  const [deployBase, { isLoading }] = useBotsDeployBaseMutation()
  const [isConfirming, setIsConfirming] = useState(false)

  async function deploy() {
    try {
      const seed = form.getFieldValue('spawnSeed')
      await deployBase({
        deployBaseDto: { password: form.getFieldValue('password'), ...(seed && { spawnSeed: seed }) }
      }).unwrap()
    } catch (error) {
      const body = (error as { data?: { code?: string; error?: string } }).data
      errorNotification(getErrorMessage({ code: body?.code, message: body?.error }), t('failed'))
    } finally {
      setIsConfirming(false)
    }
  }

  return (
    <div className="deploy-base">
      <h2>{t('title')}</h2>
      <p>{t('intro')}</p>

      <Form form={form} layout="vertical" autoComplete="off" onFinish={() => setIsConfirming(true)}>
        <Form.Item
          name="password"
          label={t('password')}
          extra={t('passwordHelp', { min: BOT_PASSWORD_MIN_LENGTH, max: BOT_PASSWORD_MAX_LENGTH })}
          rules={[
            { required: true, message: t('passwordRequired') },
            {
              min: BOT_PASSWORD_MIN_LENGTH,
              max: BOT_PASSWORD_MAX_LENGTH,
              message: t('passwordLength', { min: BOT_PASSWORD_MIN_LENGTH, max: BOT_PASSWORD_MAX_LENGTH })
            }
          ]}
        >
          <Input.Password />
        </Form.Item>

        <Form.Item
          name="confirmation"
          label={t('confirmation')}
          dependencies={['password']}
          rules={[
            { required: true, message: t('confirmationRequired') },
            ({ getFieldValue }) => ({
              validator: (_, value) =>
                !value || getFieldValue('password') === value
                  ? Promise.resolve()
                  : Promise.reject(new Error(t('confirmationMismatch')))
            })
          ]}
        >
          <Input.Password />
        </Form.Item>

        <Form.Item
          name="spawnSeed"
          label={t('spawnSeed')}
          normalize={(value?: string) => value?.trim()}
          extra={t('spawnSeedHelp')}
          rules={[{ pattern: SPAWN_SEED_PATTERN, message: t('spawnSeedInvalid') }]}
        >
          <Input autoComplete="off" />
        </Form.Item>

        <Button htmlType="submit" type="primary">
          {t('submit')}
        </Button>
      </Form>

      <Modal
        open={isConfirming}
        title={t('confirmTitle')}
        okText={t('confirmOk')}
        cancelText={t('confirmCancel')}
        confirmLoading={isLoading}
        onOk={deploy}
        onCancel={() => setIsConfirming(false)}
      >
        {t('confirmText')}
      </Modal>
    </div>
  )
}
