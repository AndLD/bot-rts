'use client'

import { useTranslations } from 'next-intl'
import { CellDescription } from './describeCell'

interface Props {
  x: number
  y: number
  description: CellDescription
}

// What is known about the selected cell
export default function CellInspector({ x, y, description }: Props) {
  const t = useTranslations('map')

  return (
    <div className="map-inspector" role="status">
      <strong>{t('cell', { x, y })}</strong>
      <div>{t(description.title.key, description.title.values)}</div>
      {description.details.map((detail) => (
        <div key={detail.key} className="map-inspector-detail">
          {t(detail.key, detail.values)}
        </div>
      ))}
    </div>
  )
}
