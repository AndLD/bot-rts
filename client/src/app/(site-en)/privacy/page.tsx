import { privacyMetadata, PrivacyView } from '../../../site/privacy/PrivacyView'

export const metadata = privacyMetadata('en')

export default function PrivacyPage() {
  return <PrivacyView locale="en" />
}
