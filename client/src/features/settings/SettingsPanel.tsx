'use client'

import { MANUAL_CATEGORIES, ManualCategory } from '@lib/utils/interfaces/settings'
import { Select, Switch, Tag } from 'antd'
import { useTranslations } from 'next-intl'
import {
  useAdminSettingsUpdateMutation,
  useSettingsGetQuery,
  useSettingsUpdateMutation,
  useUsersMeQuery
} from '../../shared/api'

type MotionChoice = 'system' | 'reduced' | 'full'

const motionChoice = (reducedMotion: boolean | null): MotionChoice =>
  reducedMotion === null ? 'system' : reducedMotion ? 'reduced' : 'full'

const reducedMotionOf = (choice: MotionChoice): boolean | null => (choice === 'system' ? null : choice === 'reduced')

// The settings of the player, and for an admin those of the game (design §15.1): which categories of manual control are on.
// What the game switches off the player cannot switch on; the player can switch off more for themselves.
export default function SettingsPanel() {
  const t = useTranslations('settings')
  const { data: settings, isError } = useSettingsGetQuery()
  const { data: me } = useUsersMeQuery()
  const [updateUser] = useSettingsUpdateMutation()
  const [updateGame] = useAdminSettingsUpdateMutation()
  const isAdmin = me?.status === 'admin' || me?.status === 'owner'

  if (isError) {
    return <div style={{ padding: 10 }}>{t('loadFailed')}</div>
  }
  if (!settings) {
    return <div style={{ padding: 10 }}>{t('loading')}</div>
  }

  return (
    <div className="settings-panel" style={{ padding: 10 }}>
      <h4>{t('manualControl')}</h4>
      <p>{t('manualControlHelp')}</p>
      {MANUAL_CATEGORIES.map((category) => (
        <CategoryRow
          key={category}
          category={category}
          label={t(`categories.${category}`)}
          isOn={settings.user.categories[category]}
          isOffInGame={!settings.global.categories[category]}
          onChange={(isOn) => updateUser({ updateUserSettingsDto: { categories: { [category]: isOn } } })}
        />
      ))}

      <h4>{t('motion')}</h4>
      <Select<MotionChoice>
        size="small"
        aria-label={t('motion')}
        value={motionChoice(settings.user.reducedMotion)}
        onChange={(choice) => updateUser({ updateUserSettingsDto: { reducedMotion: reducedMotionOf(choice) } })}
        options={[
          { value: 'system', label: t('motionChoices.system') },
          { value: 'reduced', label: t('motionChoices.reduced') },
          { value: 'full', label: t('motionChoices.full') }
        ]}
        style={{ minWidth: 200 }}
      />

      {isAdmin && (
        <>
          <h4>{t('gameSettings')}</h4>
          <p>{t('gameSettingsHelp')}</p>
          {MANUAL_CATEGORIES.map((category) => (
            <CategoryRow
              key={category}
              category={category}
              label={t(`categories.${category}`)}
              isOn={settings.global.categories[category]}
              isGlobal
              onChange={(isOn) => updateGame({ updateGameSettingsDto: { categories: { [category]: isOn } } })}
            />
          ))}
        </>
      )}
    </div>
  )
}

function CategoryRow({
  category,
  label,
  isOn,
  isOffInGame = false,
  isGlobal = false,
  onChange
}: {
  category: ManualCategory
  label: string
  isOn: boolean
  isOffInGame?: boolean
  isGlobal?: boolean
  onChange(isOn: boolean): void
}) {
  const t = useTranslations('settings')

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
      <Switch
        size="small"
        checked={isOn}
        aria-label={`${isGlobal ? t('gamePrefix') : ''}${label}`}
        data-category={category}
        onChange={onChange}
      />
      <span>{label}</span>
      {isOffInGame && <Tag color="warning">{t('offInGame')}</Tag>}
    </div>
  )
}
