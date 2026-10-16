'use client'

import { useMemo, useState } from 'react'
import { Card, Drawer, Empty } from 'antd'
import { useTranslations } from 'next-intl'
import type { IMetricHealth, MetricRange } from '@lib/utils/admin'
import { useMonitoringSeriesQuery } from '../../../shared/api'
import TraceView from '../logs/TraceView'
import LineChart from './LineChart'
import { formatMetric } from './metric-format'
import { markOf } from './slowest-marks'

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
  const [openTrace, setOpenTrace] = useState<string | null>(null)
  const title = t(`metrics.${metric}`)
  const slowest = useMemo(() => (data ? markOf(data.points, data.slowest ?? []) : []), [data])

  return (
    <Card size="small" title={title}>
      {data && data.points.length > 0 ? (
        <LineChart
          points={data.points}
          label={title}
          format={(value) => formatMetric(value, unit)}
          marks={slowest.map(({ index, sample }) => ({
            index,
            label: t('openTrace', { duration: formatMetric(sample.durationMs, 'ms') }),
            target: sample.traceId
          }))}
          onSelect={setOpenTrace}
        />
      ) : (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('noData')} />
      )}
      <Drawer
        open={openTrace !== null}
        onClose={() => setOpenTrace(null)}
        width={1000}
        title={t('traceTitle')}
        destroyOnClose
      >
        {openTrace ? <TraceView id={openTrace} /> : null}
      </Drawer>
    </Card>
  )
}
