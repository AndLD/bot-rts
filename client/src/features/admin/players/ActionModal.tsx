'use client'

import { Form, Input, Modal } from 'antd'
import { ReactNode } from 'react'
import { useTranslations } from 'next-intl'

export interface ActionValues {
  reason: string
  [field: string]: unknown
}

interface ActionModalProps {
  title: string
  isOpen: boolean
  isLoading: boolean
  // Extra fields of the action, besides the reason
  children?: ReactNode
  initialValues?: Record<string, unknown>
  onSubmit: (values: ActionValues) => void | Promise<void>
  onCancel: () => void
}

// Every action of the console says why (design §25.2); the reason goes to the audit trail
export default function ActionModal({
  title,
  isOpen,
  isLoading,
  children,
  initialValues,
  onSubmit,
  onCancel
}: ActionModalProps) {
  const t = useTranslations('admin.players.action')
  const [form] = Form.useForm<ActionValues>()

  return (
    <Modal
      open={isOpen}
      title={title}
      okText={t('confirm')}
      cancelText={t('cancel')}
      confirmLoading={isLoading}
      onCancel={onCancel}
      onOk={() => form.submit()}
      afterClose={() => form.resetFields()}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" initialValues={initialValues} onFinish={onSubmit}>
        {children}
        <Form.Item
          name="reason"
          label={t('reason')}
          rules={[{ required: true, min: 3, max: 500, message: t('reasonRequired') }]}
        >
          <Input.TextArea rows={3} maxLength={500} />
        </Form.Item>
      </Form>
    </Modal>
  )
}
