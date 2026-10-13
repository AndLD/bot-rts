'use client'

import { TrophyFilled, TrophyOutlined } from '@ant-design/icons'
import { Progress } from 'antd'
import { useLocale, useTranslations } from 'next-intl'
import { useAchievementsListQuery } from '../../shared/api'
import { useAchievementText } from './useAchievementText'
import './AchievementsPanel.scss'

// What the player has earned and how far they are from the rest (design §23): unlocked ones first, with the date, and locked
// ones with a progress bar
export default function AchievementsPanel() {
  const t = useTranslations('achievements')
  const locale = useLocale()
  const textOf = useAchievementText()
  const { data: achievements, isError } = useAchievementsListQuery()

  if (isError) {
    return <div className="achievements-panel">{t('loadFailed')}</div>
  }
  if (!achievements) {
    return <div className="achievements-panel">{t('loading')}</div>
  }

  const earned = achievements.filter((achievement) => achievement.unlockedAt !== null)
  const ordered = [...earned, ...achievements.filter((achievement) => achievement.unlockedAt === null)]

  return (
    <div className="achievements-panel">
      <p className="achievements-summary">{t('summary', { done: earned.length, total: achievements.length })}</p>
      <ul>
        {ordered.map((achievement) => {
          const { title, description } = textOf(achievement)
          const isEarned = achievement.unlockedAt !== null

          return (
            <li key={achievement.id} className={isEarned ? 'achievement is-earned' : 'achievement'}>
              {isEarned ? <TrophyFilled aria-hidden /> : <TrophyOutlined aria-hidden />}
              <div className="achievement-text">
                <strong>{title}</strong>
                <span>{description}</span>
                {isEarned ? (
                  <small>
                    {t('earnedOn', { date: new Date(achievement.unlockedAt as number).toLocaleDateString(locale) })}
                  </small>
                ) : (
                  <Progress
                    size="small"
                    percent={Math.round((achievement.progress / achievement.threshold) * 100)}
                    format={() => t('progress', { progress: achievement.progress, threshold: achievement.threshold })}
                  />
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
