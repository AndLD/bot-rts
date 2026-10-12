'use client'

import { Button, Input, Select } from 'antd'
import { ScriptFunctionSpec } from '@lib/utils/script-api'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { ActionInputs, buildArgs } from './actionForm'
import { ActionOutcome } from './useBotAction'

interface ModuleChoice {
  _id: string
  name: string
}

interface Props {
  spec: ScriptFunctionSpec
  isDisabled: boolean
  // The bot's modules, for the actions that name one
  modules: readonly ModuleChoice[]
  perform(fn: string, args: unknown[]): Promise<ActionOutcome>
}

// One action of the script API as a line of inputs and a button (design §15.1)
export default function ActionRow({ spec, isDisabled, modules, perform }: Props) {
  const t = useTranslations('control')
  const [inputs, setInputs] = useState<ActionInputs>({})
  const [isBusy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null)

  async function run() {
    const built = buildArgs(spec, inputs)

    if (!built.ok) {
      setMessage({
        text: t(built.reason === 'missing' ? 'missingArg' : 'invalidArg', { arg: built.arg }),
        isError: true
      })
      return
    }

    setBusy(true)
    const outcome = await perform(spec.name, built.args)
    setBusy(false)
    setMessage(
      outcome.ok
        ? {
            text:
              outcome.data === undefined
                ? t('done')
                : t('doneWith', { data: JSON.stringify(outcome.data).slice(0, 200) }),
            isError: false
          }
        : { text: outcome.message as string, isError: true }
    )
  }

  const set = (name: string) => (value: string) => setInputs((previous) => ({ ...previous, [name]: value }))

  return (
    <div className="control-action" style={{ marginBottom: 6 }}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        <code>{spec.name}</code>
        {spec.args.map((arg) =>
          arg.name === 'moduleId' ? (
            <Select
              key={arg.name}
              size="small"
              style={{ minWidth: 150 }}
              placeholder={arg.name}
              aria-label={`${spec.name} ${arg.name}`}
              disabled={isDisabled}
              value={inputs[arg.name]}
              onChange={set(arg.name)}
              options={modules.map((module) => ({ value: module._id, label: module.name }))}
            />
          ) : arg.kind === 'direction' ? (
            <Select
              key={arg.name}
              size="small"
              style={{ minWidth: 90 }}
              placeholder={arg.name}
              aria-label={`${spec.name} ${arg.name}`}
              disabled={isDisabled}
              value={inputs[arg.name]}
              onChange={set(arg.name)}
              options={[
                { value: 'left', label: t('left') },
                { value: 'right', label: t('right') }
              ]}
            />
          ) : (
            <Input
              key={arg.name}
              size="small"
              style={{ width: arg.kind === 'integer' ? 70 : 140 }}
              placeholder={arg.isOptional ? `${arg.name}?` : arg.name}
              aria-label={`${spec.name} ${arg.name}`}
              disabled={isDisabled}
              value={inputs[arg.name] ?? ''}
              onChange={(event) => set(arg.name)(event.target.value)}
            />
          )
        )}
        <Button
          size="small"
          type="primary"
          disabled={isDisabled || isBusy}
          aria-label={t('do', { action: spec.name })}
          onClick={run}
        >
          {t('run')}
        </Button>
      </div>
      {message && (
        <div role="status" style={{ color: message.isError ? '#f87171' : '#86efac' }}>
          {message.text}
        </div>
      )}
    </div>
  )
}
