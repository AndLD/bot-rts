'use client'

import { Alert, Button, Card, Descriptions, InputNumber, Select, Space, TimePicker, TimePickerProps } from 'antd'
import { useTranslations } from 'next-intl'
import { useMemo, useState } from 'react'
import { hasPermission } from '@lib/utils/admin'
import {
  ADVANCE_STEPS_MS,
  clockTextOf,
  DAY_LENGTH_MAX_MS,
  DAY_LENGTH_MIN_MS,
  DAY_LENGTH_PRESETS_MS,
  dayPhaseOf,
  GameTimeConfig,
  sunlightOf
} from '@lib/utils/game-time'
import {
  useDevToolsAdvanceClockMutation,
  useGameTimeAdminLeaveRealWorldMutation,
  useGameTimeAdminSetDayLengthMutation,
  useGameTimeAdminSetRealWorldMutation,
  useGameTimeAdminSetTimeOfDayMutation,
  useGameTimeAdminViewQuery
} from '../../../shared/api'
import { useServerClock } from '../../factory/useServerClock'
import { useAdminMe } from '../admin-me-context'
import ActionModal, { ActionValues } from '../players/ActionModal'
import { useReportFailure } from '../use-report-failure'

type PickedTime = Parameters<NonNullable<TimePickerProps['onChange']>>[0]

type Pending =
  | { type: 'timeOfDay'; minuteOfDay: number }
  | { type: 'dayLength'; dayLengthMs: number }
  | { type: 'realWorld'; timeZone: string }
  | { type: 'cycle' }
  | { type: 'advance'; stepMs: number }

const MINUTE_MS = 60_000
const STEP_KEYS: Record<number, string> = {
  [ADVANCE_STEPS_MS[0]]: 'minute',
  [ADVANCE_STEPS_MS[1]]: 'hour',
  [ADVANCE_STEPS_MS[2]]: 'day'
}

// The zones the browser knows (every current browser and Node 22 have this)
const zones = (): string[] => [
  'UTC',
  ...(Intl as unknown as { supportedValuesOf: (key: string) => string[] }).supportedValuesOf('timeZone')
]

const minutesText = (ms: number) => {
  const hours = Math.floor(ms / 3_600_000)
  const minutes = Math.round((ms % 3_600_000) / MINUTE_MS)

  return `${hours ? `${hours} h ` : ''}${minutes || !hours ? `${minutes} min` : ''}`.trim()
}

// The Game time tab (design §25.3): the clock of the game, live, and what an owner or admin can do to it. Every change says why, is
// audited, and reaches the engine and every connected player at once.
export default function GameTimePage() {
  const t = useTranslations('admin.gameTime')
  const { role } = useAdminMe()
  const report = useReportFailure()
  const { data, isError } = useGameTimeAdminViewQuery(undefined, { pollingInterval: 15_000 })
  const [setTimeOfDay, timeOfDayState] = useGameTimeAdminSetTimeOfDayMutation()
  const [setDayLength, dayLengthState] = useGameTimeAdminSetDayLengthMutation()
  const [setRealWorld, realWorldState] = useGameTimeAdminSetRealWorldMutation()
  const [leaveRealWorld, cycleState] = useGameTimeAdminLeaveRealWorldMutation()
  const [advance, advanceState] = useDevToolsAdvanceClockMutation()
  const [pending, setPending] = useState<Pending | null>(null)
  const [time, setTime] = useState<PickedTime | null>(null)
  const [customMinutes, setCustomMinutes] = useState<number | null>(null)
  const [zone, setZone] = useState<string | undefined>(undefined)
  const now = useServerClock(data?.now)
  const options = useMemo(() => zones().map((value) => ({ value, label: value })), [])
  const canChange = hasPermission(role, 'ops.game-time')
  const canAdvance = Boolean(data?.canAdvance) && hasPermission(role, 'devtools.use')

  if (isError) {
    return <Alert type="error" message={t('loadFailed')} />
  }
  if (!data || now === undefined) {
    return null
  }

  const config = data.config as GameTimeConfig
  const { settings } = data
  const sunlight = Math.round(sunlightOf(now, config) * 100)

  async function submit({ reason }: ActionValues) {
    const current = pending as Pending
    const result =
      current.type === 'timeOfDay'
        ? await setTimeOfDay({ setTimeOfDayDto: { minuteOfDay: current.minuteOfDay, reason } })
        : current.type === 'dayLength'
          ? await setDayLength({ setDayLengthDto: { dayLengthMs: current.dayLengthMs, reason } })
          : current.type === 'realWorld'
            ? await setRealWorld({ setRealWorldDto: { timeZone: current.timeZone, reason } })
            : current.type === 'cycle'
              ? await leaveRealWorld({ reasonDto: { reason } })
              : await advance({ advanceClockDto: { stepMs: current.stepMs, reason } })

    if (!report(result)) {
      setPending(null)
    }
  }

  const isLoading =
    timeOfDayState.isLoading ||
    dayLengthState.isLoading ||
    realWorldState.isLoading ||
    cycleState.isLoading ||
    advanceState.isLoading

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Card size="small" title={t('clock.title')}>
        <Descriptions size="small" column={{ xs: 1, md: 3 }}>
          <Descriptions.Item label={t('clock.time')}>
            <strong data-testid="game-time-clock">{clockTextOf(now, config)}</strong>
          </Descriptions.Item>
          <Descriptions.Item label={t('clock.phase')}>{t(`phases.${dayPhaseOf(now, config)}`)}</Descriptions.Item>
          <Descriptions.Item label={t('clock.sunlight')}>{sunlight} %</Descriptions.Item>
          <Descriptions.Item label={t('clock.mode')}>
            {settings.mode === 'realWorld'
              ? t('clock.realWorld', { zone: settings.timeZone as string })
              : t('clock.cycle', { length: minutesText(settings.dayLengthMs) })}
          </Descriptions.Item>
          <Descriptions.Item label={t('clock.offset')}>
            {settings.offsetMs ? t('clock.ahead', { length: minutesText(settings.offsetMs) }) : t('clock.none')}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {!canChange ? <Alert type="info" message={t('readOnly')} /> : null}

      {canChange ? (
        <>
          <Card size="small" title={t('timeOfDay.title')}>
            <p>{t('timeOfDay.help')}</p>
            <Space>
              <TimePicker
                format="HH:mm"
                value={time}
                onChange={setTime}
                needConfirm={false}
                aria-label={t('timeOfDay.title')}
              />
              <Button
                type="primary"
                disabled={!time}
                onClick={() =>
                  setPending({
                    type: 'timeOfDay',
                    minuteOfDay: (time as PickedTime).hour() * 60 + (time as PickedTime).minute()
                  })
                }
              >
                {t('timeOfDay.set')}
              </Button>
            </Space>
          </Card>

          <Card size="small" title={t('dayLength.title')}>
            <p>{t('dayLength.help')}</p>
            <Space wrap>
              {DAY_LENGTH_PRESETS_MS.map((length) => (
                <Button
                  key={length}
                  type={length === settings.dayLengthMs && settings.mode === 'cycle' ? 'primary' : 'default'}
                  onClick={() => setPending({ type: 'dayLength', dayLengthMs: length })}
                >
                  {minutesText(length)}
                </Button>
              ))}
              <InputNumber
                min={DAY_LENGTH_MIN_MS / MINUTE_MS}
                max={DAY_LENGTH_MAX_MS / MINUTE_MS}
                precision={0}
                value={customMinutes}
                onChange={setCustomMinutes}
                suffix={t('dayLength.minutes')}
                aria-label={t('dayLength.custom')}
              />
              <Button
                disabled={!customMinutes}
                onClick={() => setPending({ type: 'dayLength', dayLengthMs: (customMinutes as number) * MINUTE_MS })}
              >
                {t('dayLength.set')}
              </Button>
            </Space>
          </Card>

          <Card size="small" title={t('realWorld.title')}>
            <p>{t('realWorld.help')}</p>
            <Space wrap>
              <Select
                showSearch
                style={{ minWidth: 240 }}
                options={options}
                value={zone}
                onChange={setZone}
                placeholder={t('realWorld.zone')}
                aria-label={t('realWorld.zone')}
              />
              <Button disabled={!zone} onClick={() => setPending({ type: 'realWorld', timeZone: zone as string })}>
                {t('realWorld.sync')}
              </Button>
              {settings.mode === 'realWorld' ? (
                <Button onClick={() => setPending({ type: 'cycle' })}>{t('realWorld.leave')}</Button>
              ) : null}
            </Space>
          </Card>
        </>
      ) : null}

      {canAdvance ? (
        <Card size="small" title={t('advance.title')}>
          <p>{t('advance.help')}</p>
          <Space>
            {ADVANCE_STEPS_MS.map((step) => (
              <Button key={step} danger onClick={() => setPending({ type: 'advance', stepMs: step })}>
                {t(`advance.${STEP_KEYS[step]}`)}
              </Button>
            ))}
          </Space>
        </Card>
      ) : null}

      {pending ? (
        <ActionModal
          title={t(`confirm.${pending.type}`)}
          isOpen
          isLoading={isLoading}
          onSubmit={submit}
          onCancel={() => setPending(null)}
        />
      ) : null}
    </Space>
  )
}
