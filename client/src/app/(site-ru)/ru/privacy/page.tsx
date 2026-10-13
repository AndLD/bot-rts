import { privacyMetadata, PrivacyView } from '../../../../site/privacy/PrivacyView'

export const metadata = privacyMetadata('ru')

export default function PrivacyPage() {
  return <PrivacyView locale="ru" />
}
