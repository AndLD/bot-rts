'use client'

import { Alert } from 'antd'
import type { Feature } from '@lib/utils/interfaces/features'
import { useTranslations } from 'next-intl'

// Tells a player that a feature is switched off for now
export default function FeatureOffNotice({ feature }: { feature: Feature }) {
  const t = useTranslations('featureOff')

  return <Alert type="warning" showIcon message={t(feature)} style={{ marginBottom: 12 }} />
}
