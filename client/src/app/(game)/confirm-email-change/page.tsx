import { Suspense } from 'react'
import LinkResultPage from '../../../features/auth/LinkResultPage'

// The page reads the token of the emailed link from the query string
export default function Page() {
  return (
    <Suspense>
      <LinkResultPage action="confirmEmailChange" />
    </Suspense>
  )
}
