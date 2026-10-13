'use client'

import { useTranslations } from 'next-intl'
import './DayNight.scss'
import { useGameTime } from './useGameTime'

// The in-game time and the part of the day, in the corner of the game screen
export default function GameClock() {
  const t = useTranslations('daynight')
  const time = useGameTime()

  if (!time) {
    return null
  }

  return (
    <div className="game-clock" role="status" aria-label={t('label')} data-testid="game-clock">
      {time.clock} · {t(`phases.${time.phase}`)}
    </div>
  )
}
