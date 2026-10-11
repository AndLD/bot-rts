import { Suspense } from 'react'
import VerificationPage from '../../../features/auth/VerificationPage'

// The page reads the token of the emailed link from the query string
export default function Page() {
  return (
    <Suspense>
      <VerificationPage />
    </Suspense>
  )
}
