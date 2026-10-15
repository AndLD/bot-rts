'use client'

import { notification } from 'antd'
import { useTranslations } from 'next-intl'
import { useEffect } from 'react'
import { useSocket } from '../../shared/socket/socket-context'
import './DayNight.scss'
import { useGameTime } from './useGameTime'

// The in-game time and the part of the day, in the corner of the game screen
export default function GameClock() {
  const t = useTranslations('daynight')
  const time = useGameTime()
  const socket = useSocket()

  // An admin changed the time of the game: the clock is read again by the socket provider, and the player is told why it moved
  useEffect(() => {
    const tell = () => notification.info({ message: t('changed') })

    socket?.on('game-time-changed', tell)

    return () => void socket?.off('game-time-changed', tell)
  }, [socket, t])

  if (!time) {
    return null
  }

  return (
    <div className="game-clock" role="status" aria-label={t('label')} data-testid="game-clock">
      {time.clock} · {t(`phases.${time.phase}`)}
    </div>
  )
}
