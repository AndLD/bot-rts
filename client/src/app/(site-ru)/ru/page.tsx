import { landingMetadata, LandingView } from '../../../site/landing/LandingView'

export const metadata = landingMetadata('ru')

export default function LandingPage() {
  return <LandingView locale="ru" />
}
