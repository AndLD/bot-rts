import { LoadingOutlined } from '@ant-design/icons'
import { useNavigate, useSearchParams } from 'react-router-dom'
// import { useToken } from '../hooks/auth'
// import { useRefreshToken } from '../hooks/store/auth.api'
import { useVerifyEmail } from '../hooks/store/users.api'
import '../styles/Verification.scss'
import { useLogout } from '../hooks/store/auth.api'
import { useToken } from '../hooks/auth'

export default function Verification() {
    const [queryParams] = useSearchParams()
    const navigate = useNavigate()
    const token = useToken()
    const emailVerificationToken = queryParams.get('token')
    const logout = useLogout()

    // const token = useToken()
    // const refreshToken = useRefreshToken(() => setIsLoading(false))

    useVerifyEmail(emailVerificationToken, () => {
        if (token) {
            logout(() => navigate('/auth'))
        } else {
            navigate('/auth')
        }
        // if (token) {
        //     refreshToken()
        // } else {
        //     setIsLoading(false)
        // }
    })

    return (
        <div className="verification-container">
            <LoadingOutlined />
        </div>
    )
}
