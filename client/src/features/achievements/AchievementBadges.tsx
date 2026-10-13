'use client'

import { TrophyFilled } from '@ant-design/icons'
import { Tag } from 'antd'
import { useTranslations } from 'next-intl'
import { useAchievementsListQuery } from '../../shared/api'
import { useAchievementText } from './useAchievementText'
import './AchievementsPanel.scss'

// The badges the player has earned, for their profile (design §23.1): one for each, recognition only
export default function AchievementBadges() {
  const t = useTranslations('achievements')
  const textOf = useAchievementText()
  const { data: achievements } = useAchievementsListQuery()
  const earned = (achievements ?? []).filter((achievement) => achievement.unlockedAt !== null)

  if (earned.length === 0) {
    return <p>{t('noBadges')}</p>
  }

  return (
    <div className="achievement-badges">
      {earned.map((achievement) => (
        <Tag key={achievement.id} icon={<TrophyFilled />} color="gold" title={textOf(achievement).description}>
          {textOf(achievement).title}
        </Tag>
      ))}
    </div>
  )
}
