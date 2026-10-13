'use client'

import { Button, Input, Select } from 'antd'
import { ScriptFunctionSpec } from '@lib/utils/script-api'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { ActionInputs, buildArgs } from './actionForm'
import { ActionOutcome } from './useBotAction'
import './ControlPanel.scss'

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
    <div className="control-action">
      <div className="control-action-line">
        <code>{spec.name}</code>
        <div className="control-action-inputs">
          {spec.args.map((arg) =>
            arg.name === 'moduleId' ? (
              <Select
                key={arg.name}
                size="small"
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
                placeholder={arg.isOptional ? `${arg.name}?` : arg.name}
                aria-label={`${spec.name} ${arg.name}`}
                disabled={isDisabled}
                value={inputs[arg.name] ?? ''}
                onChange={(event) => set(arg.name)(event.target.value)}
              />
            )
          )}
        </div>
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
        <div role="status" className="control-action-message" data-error={message.isError}>
          {message.text}
        </div>
      )}
    </div>
  )
}
