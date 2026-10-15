'use client'

import { Alert, Button, Card, Form, Input, InputNumber, Space, Switch, Table, Tag } from 'antd'
import { useFormatter, useTranslations } from 'next-intl'
import { useState } from 'react'
import { hasPermission } from '@lib/utils/admin'
import {
  ERASURE_CONFIRMATION,
  JOBS_WITHOUT_SWITCH,
  RETENTION_RANGES,
  RetentionJob,
  RetentionValues
} from '@lib/utils/admin-retention'
import { useRetentionGetQuery, useRetentionResetMutation, useRetentionUpdateMutation } from '../../../shared/api'
import { useAdminMe } from '../admin-me-context'
import ActionModal from '../players/ActionModal'
import { useReportFailure } from '../use-report-failure'

type Draft = Partial<Record<RetentionJob, RetentionValues>>
type Pending = { type: 'save' } | { type: 'reset' }

// The retention jobs of the game (design §25.3, Operations): each with its switch, its ranges within their floor and ceiling, its
// default, and what its last pass removed. Changes are staged, then saved together with a reason; one button puts every value back.
export default function RetentionCard() {
  const t = useTranslations('admin.operations.retention')
  const format = useFormatter()
  const { role } = useAdminMe()
  const report = useReportFailure()
  const { data, isError } = useRetentionGetQuery()
  const [update, updateState] = useRetentionUpdateMutation()
  const [reset, resetState] = useRetentionResetMutation()
  const [draft, setDraft] = useState<Draft>({})
  const [pending, setPending] = useState<Pending | null>(null)
  const canWrite = hasPermission(role, 'ops.retention')
  const jobs = data?.jobs ?? []
  const isDirty = Object.keys(draft).length > 0
  const value = (job: RetentionValues, name: RetentionJob, field: string) => draft[name]?.[field] ?? job[field]
  const isErasureSwitchedOn =
    draft.inactiveAccounts?.isEnabled === true &&
    jobs.find((entry) => entry.job === 'inactiveAccounts')?.values.isEnabled === false

  function stage(name: RetentionJob, field: string, next: number | boolean | null) {
    if (next === null) {
      return
    }
    setDraft((current) => ({ ...current, [name]: { ...current[name], [field]: next } }))
  }

  async function submit({ reason, confirmation }: { reason: string; confirmation?: unknown }) {
    const result =
      (pending as Pending).type === 'save'
        ? await update({
            updateRetentionDto: { jobs: draft, reason, confirmation: confirmation as string | undefined }
          })
        : await reset({ reasonOnlyDto: { reason } })

    if (report(result)) {
      return
    }
    setDraft({})
    setPending(null)
  }

  if (isError) {
    return <Alert type="error" message={t('loadFailed')} />
  }

  return (
    <Card size="small" title={t('title')}>
      <p>{t('help')}</p>
      {data?.hasFailures ? <Alert type="warning" showIcon message={t('failures')} style={{ marginBottom: 8 }} /> : null}
      <Table
        size="small"
        rowKey="job"
        pagination={false}
        dataSource={jobs}
        columns={[
          { title: t('columns.job'), dataIndex: 'job', render: (name: RetentionJob) => t(`jobs.${name}`) },
          {
            title: t('columns.enabled'),
            render: (_, { job, values }) =>
              JOBS_WITHOUT_SWITCH.includes(job) ? (
                '–'
              ) : (
                <Switch
                  size="small"
                  checked={value(values, job, 'isEnabled') as boolean}
                  disabled={!canWrite}
                  aria-label={t(`jobs.${job}`)}
                  onChange={(isOn) => stage(job, 'isEnabled', isOn)}
                />
              )
          },
          {
            title: t('columns.ranges'),
            render: (_, { job, values, defaults }) => (
              <Space wrap>
                {Object.entries(RETENTION_RANGES[job]).map(([field, range]) => (
                  <label key={field}>
                    {t(`fields.${field}`)}{' '}
                    <InputNumber
                      size="small"
                      min={range.min}
                      max={range.max}
                      precision={0}
                      disabled={!canWrite}
                      value={value(values, job, field) as number}
                      aria-label={`${t(`jobs.${job}`)}: ${t(`fields.${field}`)}`}
                      onChange={(next) => stage(job, field, next)}
                    />{' '}
                    <small>
                      {t(`units.${range.unit}`)} ({t('default', { value: String(defaults[field]) })},{' '}
                      {t('range', { min: range.min, max: range.max })})
                    </small>
                  </label>
                ))}
              </Space>
            )
          },
          {
            title: t('columns.lastRemoved'),
            dataIndex: 'lastRemoved',
            render: (removed: number | null) => (removed === null ? '–' : removed)
          },
          {
            title: t('columns.state'),
            dataIndex: 'isOverridden',
            render: (isOverridden: boolean) => (isOverridden ? <Tag color="blue">{t('overridden')}</Tag> : null)
          }
        ]}
      />
      <p>
        {t('lastRun', {
          date: data?.lastRunAt
            ? format.dateTime(new Date(data.lastRunAt), { dateStyle: 'short', timeStyle: 'short' })
            : '–'
        })}
      </p>
      {canWrite ? (
        <Space>
          <Button type="primary" disabled={!isDirty} onClick={() => setPending({ type: 'save' })}>
            {t('save')}
          </Button>
          <Button disabled={!isDirty} onClick={() => setDraft({})}>
            {t('discard')}
          </Button>
          <Button danger onClick={() => setPending({ type: 'reset' })}>
            {t('reset')}
          </Button>
        </Space>
      ) : null}
      {pending ? (
        <ActionModal
          title={t(pending.type === 'save' ? 'saveTitle' : 'resetTitle')}
          isOpen
          isLoading={updateState.isLoading || resetState.isLoading}
          onSubmit={submit}
          onCancel={() => setPending(null)}
        >
          {pending.type === 'save' && isErasureSwitchedOn ? (
            <Form.Item
              name="confirmation"
              label={t('confirmErasure', { word: ERASURE_CONFIRMATION })}
              rules={[{ required: true, pattern: new RegExp(`^${ERASURE_CONFIRMATION}$`) }]}
            >
              <Input autoComplete="off" />
            </Form.Item>
          ) : null}
        </ActionModal>
      ) : null}
    </Card>
  )
}
