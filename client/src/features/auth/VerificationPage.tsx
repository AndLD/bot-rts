'use client'

import { LoadingOutlined } from '@ant-design/icons'
import { useRouter, useSearchParams } from 'next/navigation'
import { useToken } from '../../shared/store/hooks'
import { useLogout, useVerifyEmail } from './hooks'
import './VerificationPage.scss'

export default function VerificationPage() {
  const queryParams = useSearchParams()
  const router = useRouter()
  const token = useToken()
  const logout = useLogout()

  useVerifyEmail(queryParams.get('token'), () => {
    if (token) {
      logout(() => router.push('/auth'))
    } else {
      router.push('/auth')
    }
  })

  return (
    <div className="verification-container">
      <LoadingOutlined />
    </div>
  )
}
