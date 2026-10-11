import { LoadingOutlined } from '@ant-design/icons'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useToken } from '../../shared/store/hooks'
import { useLogout, useVerifyEmail } from './hooks'
import './VerificationPage.scss'

export default function VerificationPage() {
  const [queryParams] = useSearchParams()
  const navigate = useNavigate()
  const token = useToken()
  const logout = useLogout()

  useVerifyEmail(queryParams.get('token'), () => {
    if (token) {
      logout(() => navigate('/auth'))
    } else {
      navigate('/auth')
    }
  })

  return (
    <div className="verification-container">
      <LoadingOutlined />
    </div>
  )
}
