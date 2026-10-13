import { landingMetadata, LandingView } from '../../site/landing/LandingView'

export const metadata = landingMetadata('en')

export default function LandingPage() {
  return <LandingView locale="en" />
}
