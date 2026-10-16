'use client'

import { Card, Empty } from 'antd'
import { useTranslations } from 'next-intl'
import type { IMetricHealth, MetricRange } from '@lib/utils/admin'
import { useMonitoringSeriesQuery } from '../../../shared/api'
import LineChart from './LineChart'
import { formatMetric } from './metric-format'

const POLL_MS = 15_000

export default function MetricChart({
  metric,
  unit,
  range,
  node
}: {
  metric: string
  unit: IMetricHealth['unit']
  range: MetricRange
  // One node, or every node when absent
  node?: string
}) {
  const t = useTranslations('admin.dashboard')
  const { data } = useMonitoringSeriesQuery({ metric, range, node }, { pollingInterval: POLL_MS })
  const title = t(`metrics.${metric}`)

  return (
    <Card size="small" title={title}>
      {data && data.points.length > 0 ? (
        <LineChart points={data.points} label={title} format={(value) => formatMetric(value, unit)} />
      ) : (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('noData')} />
      )}
    </Card>
  )
}
