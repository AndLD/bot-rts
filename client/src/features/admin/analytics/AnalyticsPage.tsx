'use client'

import { Alert, Button, Card, Progress, Segmented, Space, Statistic, Table } from 'antd'
import { useState } from 'react'
import { useFormatter, useTranslations } from 'next-intl'
import { ANALYTICS_WINDOWS, AnalyticsReport, AnalyticsWindow, FunnelStep } from '@lib/utils/admin-analytics'
import { useAnalyticsReportQuery } from '../../../shared/api'
import LineChart from '../dashboard/LineChart'
import { useCsvDownload } from '../use-csv-download'

const DEFAULT_WINDOW: AnalyticsWindow = 30

// Analytics (design §25.3): active players, retention of weekly cohorts, the onboarding funnel and the share of players who earned each
// achievement; each report can be downloaded as CSV
export default function AnalyticsPage() {
  const t = useTranslations('admin.analytics')
  const format = useFormatter()
  const download = useCsvDownload()
  const [days, setDays] = useState<AnalyticsWindow>(DEFAULT_WINDOW)
  const { data, isError } = useAnalyticsReportQuery({ days })
  const percent = (share: number | null) => (share === null ? '–' : format.number(share, { style: 'percent' }))

  if (isError) {
    return <Alert type="error" message={t('loadFailed')} />
  }
  if (!data) {
    return null
  }

  const exportButton = (report: AnalyticsReport) => (
    <Button
      size="small"
      onClick={() => download(`/api/v1/admin/analytics/export?report=${report}&days=${days}`, `${report}.csv`)}
    >
      {t('export')}
    </Button>
  )
  const { activity, funnel } = data
  const signedUp = funnel[0].users

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Segmented
        value={days}
        onChange={(value) => setDays(value as AnalyticsWindow)}
        options={ANALYTICS_WINDOWS.map((value) => ({ value, label: t('window', { days: value }) }))}
      />

      <Card size="small" title={t('activity.title')} extra={exportButton('activity')}>
        <Space size="large" wrap>
          <Statistic title={t('activity.dau')} value={activity.dau} />
          <Statistic title={t('activity.mau')} value={activity.mau} />
          <Statistic
            title={t('activity.stickiness')}
            value={activity.mau ? Math.round((activity.dau / activity.mau) * 100) : 0}
            suffix="%"
          />
          <Statistic title={t('activity.players')} value={data.players} />
        </Space>
        <LineChart
          label={t('activity.chart')}
          points={activity.daily.map(({ users }, index) => [index, users])}
          format={(value) => format.number(value)}
        />
      </Card>

      <Card size="small" title={t('retention.title')} extra={exportButton('retention')}>
        <Table
          size="small"
          rowKey="cohort"
          pagination={false}
          locale={{ emptyText: t('retention.none') }}
          dataSource={data.retention}
          columns={[
            { title: t('retention.cohort'), dataIndex: 'cohort' },
            { title: t('retention.size'), dataIndex: 'size' },
            { title: t('retention.d1'), dataIndex: 'd1', render: percent },
            { title: t('retention.d7'), dataIndex: 'd7', render: percent },
            { title: t('retention.d30'), dataIndex: 'd30', render: percent }
          ]}
        />
      </Card>

      <Card size="small" title={t('funnel.title')} extra={exportButton('funnel')}>
        <Table
          size="small"
          rowKey="step"
          pagination={false}
          dataSource={funnel}
          columns={[
            { title: t('funnel.step'), dataIndex: 'step', render: (step: FunnelStep) => t(`funnel.steps.${step}`) },
            { title: t('funnel.players'), dataIndex: 'users' },
            {
              title: t('funnel.share'),
              dataIndex: 'users',
              render: (users: number) => (
                <Progress percent={signedUp ? Math.round((users / signedUp) * 100) : 0} size="small" />
              )
            }
          ]}
        />
      </Card>

      <Card size="small" title={t('achievements.title')} extra={exportButton('achievements')}>
        <Table
          size="small"
          rowKey="id"
          pagination={{ pageSize: 10, hideOnSinglePage: true }}
          dataSource={data.achievements}
          columns={[
            { title: t('achievements.id'), dataIndex: 'id' },
            { title: t('achievements.players'), dataIndex: 'unlocked' },
            { title: t('achievements.share'), dataIndex: 'share', render: percent }
          ]}
        />
      </Card>
    </Space>
  )
}
