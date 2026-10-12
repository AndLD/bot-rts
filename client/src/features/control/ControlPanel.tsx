'use client'

import { ModuleType } from '@lib/utils/interfaces/modules'
import { Tag } from 'antd'
import { useTranslations } from 'next-intl'
import { useMemo } from 'react'
import { useBotsModulesQuery, useSettingsGetQuery } from '../../shared/api'
import { useCategoryNames } from '../settings/useCategoryNames'
import ActionRow from './ActionRow'
import { actionGroups } from './actionForm'
import { useBotAction } from './useBotAction'

// The control panel of a bot (design §15.1): everything a script can ask the bot to do, by hand, in the eight categories.
// The actions are sent as engine commands and follow the rules of a script's call; a category that is switched off in the
// game or in the player's settings is shown but cannot be used (the engine refuses it too).
export default function ControlPanel({ botId }: { botId: string }) {
  const t = useTranslations('control')
  const categoryName = useCategoryNames()
  const { data: modules, isError } = useBotsModulesQuery({ id: botId })
  const { data: settings } = useSettingsGetQuery()
  const act = useBotAction(botId)
  const groups = useMemo(
    () => actionGroups(new Set((modules ?? []).map((module) => module.type as ModuleType))),
    [modules]
  )

  if (isError) {
    return <div style={{ padding: 10 }}>{t('loadFailed')}</div>
  }
  if (!modules || !settings) {
    return <div style={{ padding: 10 }}>{t('loading')}</div>
  }

  return (
    <div className="control-panel" style={{ padding: 10 }}>
      {groups.map(({ category, actions }) => {
        const isOn = category === null || settings.effective[category]

        return (
          <section key={category ?? 'observation'} data-category={category ?? 'observation'}>
            <h4>
              {category === null ? t('observation') : categoryName(category)}{' '}
              {!isOn && <Tag color="warning">{t('switchedOff')}</Tag>}
            </h4>
            {actions.map((spec) => (
              <ActionRow key={spec.name} spec={spec} isDisabled={!isOn} modules={modules} perform={act} />
            ))}
          </section>
        )
      })}
    </div>
  )
}
