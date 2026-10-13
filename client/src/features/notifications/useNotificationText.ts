import { INotification } from '@lib/utils/interfaces/notifications'
import { useTranslations } from 'next-intl'
import { useAchievementText } from '../achievements/useAchievementText'
import { useModuleName } from '../factory/useModuleName'

// A bot's id as the player sees it in a text
const SHORT_ID = 8

// The text of a notification in the player's language (design §15.4): the API sends a kind and its parameters, never a text
export function useNotificationText() {
  const t = useTranslations('notifications')
  const moduleName = useModuleName()
  const achievementText = useAchievementText()

  return (notification: INotification): string => {
    if (!t.has(`kinds.${notification.kind}`)) {
      return t('kinds.unknown')
    }
    const { params } = notification
    // ICU `select` takes text, so a flag such as `lockedOut` arrives as "true" or "false"
    const values: Record<string, string | number> = {
      ...Object.fromEntries(
        Object.entries(params).map(([name, value]) => [name, typeof value === 'boolean' ? String(value) : value])
      ),
      bot: (notification.botId ?? '').slice(0, SHORT_ID)
    }

    if (typeof params.module === 'string') {
      values.module = moduleName(params.module)
    }
    if (notification.kind === 'achievementUnlocked') {
      values.title = achievementText({
        family: String(params.family),
        level: Number(params.level),
        levels: Number(params.levels),
        threshold: Number(params.threshold)
      }).title
    }
    return t(`kinds.${notification.kind}`, values)
  }
}
