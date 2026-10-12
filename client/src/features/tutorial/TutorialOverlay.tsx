'use client'

import { Button } from 'antd'
import { CheckCircleFilled, CheckCircleOutlined } from '@ant-design/icons'
import { useTranslations } from 'next-intl'
import { useEffect, useRef, useState } from 'react'
import { useTutorialGetQuery, useTutorialSkipMutation } from '../../shared/api'

// Steps are done by the player really doing them, so the checklist asks the server every few seconds
const REFRESH_MS = 4000

// The guided checklist (design §16.1): what to do next, with the steps done ticked. It can be skipped at any time and is
// reopened from the settings.
export default function TutorialOverlay() {
  const t = useTranslations('tutorial')
  const { data: tutorial } = useTutorialGetQuery(undefined, { pollingInterval: REFRESH_MS })
  const [skip] = useTutorialSkipMutation()
  // The congratulation is for the player who has just finished, not for one who finished it long ago
  const wasActive = useRef(false)
  const [isDismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (tutorial?.status === 'active') {
      wasActive.current = true
    }
  }, [tutorial?.status])

  if (!tutorial || isDismissed) {
    return null
  }

  if (tutorial.status === 'completed' && wasActive.current) {
    return (
      <aside className="tutorial-overlay" aria-label={t('title')}>
        <strong>{t('completed')}</strong>
        <Button size="small" onClick={() => setDismissed(true)}>
          {t('close')}
        </Button>
      </aside>
    )
  }

  if (tutorial.status !== 'active') {
    return null
  }

  return (
    <aside className="tutorial-overlay" aria-label={t('title')}>
      <strong>{t('title')}</strong>
      <ol>
        {tutorial.steps.map((step) => (
          <li key={step.id} data-step={step.id} data-done={step.isDone} data-current={step.id === tutorial.current}>
            {step.isDone ? <CheckCircleFilled /> : <CheckCircleOutlined />} {t(`steps.${step.id}.title`)}
            {step.id === tutorial.current && <div className="tutorial-hint">{t(`steps.${step.id}.hint`)}</div>}
          </li>
        ))}
      </ol>
      <Button size="small" onClick={() => skip()}>
        {t('skip')}
      </Button>
    </aside>
  )
}
