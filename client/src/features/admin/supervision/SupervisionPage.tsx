'use client'

import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Form,
  Input,
  InputNumber,
  List,
  Row,
  Select,
  Space,
  Statistic,
  Tag
} from 'antd'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { HALT_CONFIRMATION, PAUSE_CONFIRMATION } from '@lib/utils/admin-players'
import { hasPermission } from '@lib/utils/admin'
import { RESOURCES } from '@lib/utils/interfaces/resources'
import {
  useSupervisionAllowMutation,
  useSupervisionCompensateMutation,
  useSupervisionGrantMutation,
  useSupervisionHaltMutation,
  useSupervisionPauseMutation,
  useSupervisionReleaseMutation,
  useSupervisionRemoveMutation,
  useSupervisionResumeMutation,
  useSupervisionRestoreMutation,
  useSupervisionStateQuery
} from '../../../shared/api'
import { useAdminMe } from '../admin-me-context'
import ActionModal, { ActionValues } from '../players/ActionModal'
import { useReportFailure } from '../use-report-failure'

type Switch = 'pause' | 'resume' | 'halt' | 'allow'
type SupportKind = 'grant' | 'compensate' | 'remove' | 'restore'

const SUPPORT_KINDS: readonly SupportKind[] = ['grant', 'compensate', 'remove', 'restore']

// The control state of the world and the actions that change it (design §25.3, Supervision): every action needs a reason, and the
// two world-wide switches need a typed word
export default function SupervisionPage() {
  const t = useTranslations('admin.supervision')
  const { role } = useAdminMe()
  const report = useReportFailure()
  const { data: state, isError } = useSupervisionStateQuery()
  const [pause, pausing] = useSupervisionPauseMutation()
  const [resume, resuming] = useSupervisionResumeMutation()
  const [halt, halting] = useSupervisionHaltMutation()
  const [allow, allowing] = useSupervisionAllowMutation()
  const [release, releaseState] = useSupervisionReleaseMutation()
  const [grant] = useSupervisionGrantMutation()
  const [compensate] = useSupervisionCompensateMutation()
  const [remove] = useSupervisionRemoveMutation()
  const [restore] = useSupervisionRestoreMutation()
  const [open, setOpen] = useState<Switch | null>(null)
  const [releaseTarget, setReleaseTarget] = useState<string | null>(null)
  const [kind, setKind] = useState<SupportKind>('grant')
  const [supportForm] = Form.useForm()
  const canPause = hasPermission(role, 'ops.pause-world')
  const canHalt = hasPermission(role, 'ops.kill-switch')
  const canQuarantine = hasPermission(role, 'supervision.quarantine')
  const canSupport = hasPermission(role, 'supervision.support')

  if (isError) {
    return <Alert type="error" message={t('loadFailed')} />
  }

  const confirmWord = open === 'pause' ? PAUSE_CONFIRMATION : HALT_CONFIRMATION
  const run: Record<Switch, (values: ActionValues) => Promise<{ error?: unknown }>> = {
    pause: ({ reason }) => pause({ pauseWorldDto: { reason, confirm: PAUSE_CONFIRMATION } }),
    resume: ({ reason }) => resume({ reasonDto: { reason } }),
    halt: ({ reason }) => halt({ haltScriptsDto: { reason, confirm: HALT_CONFIRMATION } }),
    allow: ({ reason }) => allow({ reasonDto: { reason } })
  }
  const switching = { pause: pausing, resume: resuming, halt: halting, allow: allowing }

  async function submitSwitch(values: ActionValues) {
    if (report(await run[open as Switch](values))) {
      return
    }
    setOpen(null)
  }

  async function submitRelease({ reason }: ActionValues) {
    if (report(await release({ id: releaseTarget as string, reasonDto: { reason } }))) {
      return
    }
    setReleaseTarget(null)
  }

  async function submitSupport(values: {
    botId: string
    resource?: (typeof RESOURCES)[number]
    amount?: number
    moduleId?: string
    reason: string
  }) {
    const stacks = [{ resource: values.resource as (typeof RESOURCES)[number], amount: values.amount as number }]
    const base = { botId: values.botId, reason: values.reason }
    const result =
      kind === 'restore'
        ? await restore({ restoreModuleDto: { ...base, moduleId: values.moduleId as string } })
        : await { grant, compensate, remove }[kind]({ supportResourcesDto: { ...base, stacks } })

    if (!report(result)) {
      supportForm.resetFields()
    }
  }

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}>
          <Card
            size="small"
            title={t('world')}
            extra={<Tag color={state?.isPaused ? 'red' : 'green'}>{state?.isPaused ? t('paused') : t('running')}</Tag>}
          >
            {canPause ? (
              <Button danger={!state?.isPaused} onClick={() => setOpen(state?.isPaused ? 'resume' : 'pause')}>
                {state?.isPaused ? t('resume') : t('pause')}
              </Button>
            ) : null}
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card
            size="small"
            title={t('scripts')}
            extra={
              <Tag color={state?.areScriptsHalted ? 'red' : 'green'}>
                {state?.areScriptsHalted ? t('halted') : t('allowed')}
              </Tag>
            }
          >
            {canHalt ? (
              <Button
                danger={!state?.areScriptsHalted}
                onClick={() => setOpen(state?.areScriptsHalted ? 'allow' : 'halt')}
              >
                {state?.areScriptsHalted ? t('allow') : t('halt')}
              </Button>
            ) : null}
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card size="small" title={t('executions')}>
            <Space size="large">
              <Statistic title={t('active')} value={state?.activeExecutions ?? 0} />
              <Statistic title={t('held')} value={state?.heldExecutions ?? 0} />
            </Space>
          </Card>
        </Col>
      </Row>

      <Card size="small" title={t('quarantined')}>
        <List
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('noneQuarantined')} /> }}
          dataSource={state?.quarantined ?? []}
          renderItem={(player) => (
            <List.Item
              actions={
                canQuarantine
                  ? [
                      <Button key="release" size="small" onClick={() => setReleaseTarget(player._id)}>
                        {t('release')}
                      </Button>
                    ]
                  : []
              }
            >
              {player.name}
            </List.Item>
          )}
        />
      </Card>

      {canSupport ? (
        <Card size="small" title={t('support.title')}>
          <Form form={supportForm} layout="vertical" onFinish={submitSupport} style={{ maxWidth: 480 }}>
            <Form.Item label={t('support.kind')}>
              <Select
                value={kind}
                onChange={setKind}
                options={SUPPORT_KINDS.map((value) => ({ value, label: t(`support.kinds.${value}`) }))}
              />
            </Form.Item>
            <Form.Item name="botId" label={t('support.botId')} rules={[{ required: true, len: 36 }]}>
              <Input />
            </Form.Item>
            {kind === 'restore' ? (
              <Form.Item name="moduleId" label={t('support.moduleId')} rules={[{ required: true, len: 36 }]}>
                <Input />
              </Form.Item>
            ) : (
              <Space align="start">
                <Form.Item name="resource" label={t('support.resource')} rules={[{ required: true }]}>
                  <Select style={{ width: 140 }} options={RESOURCES.map((value) => ({ value, label: value }))} />
                </Form.Item>
                <Form.Item name="amount" label={t('support.amount')} rules={[{ required: true }]}>
                  <InputNumber min={1} max={100000} />
                </Form.Item>
              </Space>
            )}
            <Form.Item name="reason" label={t('support.reason')} rules={[{ required: true, min: 3, max: 500 }]}>
              <Input.TextArea rows={2} maxLength={500} />
            </Form.Item>
            <Button type="primary" htmlType="submit">
              {t('support.submit')}
            </Button>
          </Form>
        </Card>
      ) : null}

      {open ? (
        <ActionModal
          title={t(`switch.${open}.title`)}
          isOpen
          isLoading={switching[open].isLoading}
          onSubmit={submitSwitch}
          onCancel={() => setOpen(null)}
        >
          {open === 'pause' || open === 'halt' ? (
            <Form.Item
              name="confirm"
              label={t('switch.confirm', { word: confirmWord })}
              rules={[{ required: true, pattern: new RegExp(`^${confirmWord}$`) }]}
            >
              <Input autoComplete="off" />
            </Form.Item>
          ) : null}
        </ActionModal>
      ) : null}
      {releaseTarget ? (
        <ActionModal
          title={t('releaseTitle')}
          isOpen
          isLoading={releaseState.isLoading}
          onSubmit={submitRelease}
          onCancel={() => setReleaseTarget(null)}
        />
      ) : null}
    </Space>
  )
}
