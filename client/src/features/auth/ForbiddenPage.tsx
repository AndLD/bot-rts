'use client'

import { MailOutlined } from '@ant-design/icons'

export default function ForbiddenPage() {
  return (
    <div
      style={{
        fontSize: 45,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        flexDirection: 'column',
        gap: 50
      }}
    >
      <MailOutlined style={{ fontSize: 100 }} />
      <div>Check your email. We have sent verification letter</div>
    </div>
  )
}
