import { Suspense } from 'react'
import ResetPasswordPage from '../../../features/auth/ResetPasswordPage'

// The page reads the token of the emailed link from the query string
export default function Page() {
  return (
    <Suspense>
      <ResetPasswordPage />
    </Suspense>
  )
}
