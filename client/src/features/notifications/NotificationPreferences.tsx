'use client'

import { NOTIFICATION_CATEGORIES } from '@lib/utils/interfaces/notifications'
import { Switch } from 'antd'
import { useTranslations } from 'next-intl'
import { useNotificationsPreferencesQuery, useNotificationsUpdatePreferencesMutation } from '../../shared/api'

// Which categories of notifications the player wants to hear about (design §24.2), in the settings
export default function NotificationPreferences() {
  const t = useTranslations('notifications')
  const { data } = useNotificationsPreferencesQuery()
  const [update] = useNotificationsUpdatePreferencesMutation()

  if (!data) {
    return null
  }

  return (
    <div className="notification-preferences">
      <h4>{t('preferences.title')}</h4>
      <p>{t('preferences.help')}</p>
      {NOTIFICATION_CATEGORIES.map((category) => (
        <div key={category} style={{ display: 'flex', justifyContent: 'space-between', margin: '4px 0' }}>
          <span>{t(`categories.${category}`)}</span>
          <Switch
            size="small"
            aria-label={t('preferences.notifyAbout', { category: t(`categories.${category}`) })}
            checked={data.categories[category]}
            onChange={(isOn) => update({ updateNotificationPreferencesDto: { categories: { [category]: isOn } } })}
          />
        </div>
      ))}
    </div>
  )
}
