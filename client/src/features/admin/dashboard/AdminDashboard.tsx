'use client'

import { Alert, Card, Col, Row, Segmented, Select, Space, Statistic, Tag } from 'antd'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { HealthStatus, IAreaHealth, METRIC_RANGES, MetricRange } from '@lib/utils/admin'
import { useMonitoringNodesQuery } from '../../../shared/api'
import AlertList from './AlertList'
import MetricChart from './MetricChart'
import { formatMetric } from './metric-format'
import { useLiveHealth } from './useLiveHealth'

const STATUS_COLOR: Record<HealthStatus, string> = { green: 'green', yellow: 'gold', red: 'red' }

// The charts of the dashboard, in the order shown
const CHARTS = [
  'engine.tickP95Ms',
  'engine.overrunRate',
  'scripts.running',
  'scripts.maxWaitTicks',
  'api.requestsPerSecond',
  'api.latencyP95Ms',
  'api.errorRate5xx',
  'infrastructure.rssBytes'
] as const

// Shown only when the node watches a log gateway (the metric has a value)
const GATEWAY_CHART = 'infrastructure.gatewayQueueSize'

function AreaTile({ area }: { area: IAreaHealth }) {
  const t = useTranslations('admin.dashboard')
  const headline = area.metrics.find((metric) => metric.value !== null)

  return (
    <Card
      size="small"
      title={t(`areas.${area.area}`)}
      extra={<Tag color={STATUS_COLOR[area.status]}>{t(`status.${area.status}`)}</Tag>}
    >
      <Statistic
        title={headline ? t(`metrics.${headline.id}`) : undefined}
        value={headline ? formatMetric(headline.value, headline.unit) : '–'}
      />
    </Card>
  )
}

// The health, performance and load of the game (design §25.3, §25.5): a tile and a status per area, the open alerts, and
// charts over a time range, refreshed live
export default function AdminDashboard() {
  const t = useTranslations('admin.dashboard')
  const [range, setRange] = useState<MetricRange>('1h')
  const [node, setNode] = useState<string | undefined>(undefined)
  const { data: nodes } = useMonitoringNodesQuery({ range })
  const { data: health, isError, isLive } = useLiveHealth()

  if (isError) {
    return <Alert type="error" message={t('loadFailed')} />
  }

  const hasGateway = (health?.areas ?? []).some((area) =>
    area.metrics.some((metric) => metric.id === GATEWAY_CHART && metric.value !== null)
  )
  const charts = hasGateway ? [...CHARTS, GATEWAY_CHART] : CHARTS
  const units = Object.fromEntries(
    (health?.areas ?? []).flatMap((area) => area.metrics.map((metric) => [metric.id, metric.unit]))
  )

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Space wrap>
        <Tag color={health ? STATUS_COLOR[health.status] : 'default'}>
          {health ? t(`status.${health.status}`) : t('waiting')}
        </Tag>
        <Tag color={isLive ? 'green' : 'default'}>{isLive ? t('live') : t('polling')}</Tag>
        <Segmented
          value={range}
          onChange={(value) => setRange(value as MetricRange)}
          options={METRIC_RANGES.map((value) => ({ value, label: t(`ranges.${value}`) }))}
        />
        <Select
          allowClear
          value={node}
          onChange={(value) => setNode(value)}
          placeholder={t('allNodes')}
          style={{ minWidth: 220 }}
          options={(nodes ?? []).map((id) => ({ value: id, label: id }))}
        />
      </Space>

      <Row gutter={[16, 16]}>
        {(health?.areas ?? []).map((area) => (
          <Col key={area.area} xs={24} sm={12} lg={6}>
            <AreaTile area={area} />
          </Col>
        ))}
      </Row>

      <Card size="small" title={t('alerts')}>
        <AlertList alerts={health?.alerts ?? []} />
      </Card>

      <Row gutter={[16, 16]}>
        {charts.map((metric) => (
          <Col key={metric} xs={24} md={12} xl={8}>
            <MetricChart metric={metric} unit={(units[metric] ?? 'count') as never} range={range} node={node} />
          </Col>
        ))}
      </Row>
    </Space>
  )
}
