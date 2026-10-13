'use client'

import { TrophyFilled } from '@ant-design/icons'
import { IAchievementUnlock } from '@lib/utils/interfaces/achievements'
import { notification } from 'antd'
import { useTranslations } from 'next-intl'
import { useEffect } from 'react'
import { api } from '../../shared/api'
import { useSocket } from '../../shared/socket/socket-context'
import { useAppDispatch } from '../../shared/store/hooks'
import { useAchievementText } from './useAchievementText'

// Congratulates the player when the server says an achievement was earned, also one earned while they were away (design §23.1)
export default function AchievementToasts() {
  const t = useTranslations('achievements')
  const textOf = useAchievementText()
  const socket = useSocket()
  const dispatch = useAppDispatch()

  useEffect(() => {
    if (!socket) {
      return
    }
    const onUnlocked = (unlock: IAchievementUnlock) => {
      dispatch(api.util.invalidateTags(['Achievements']))
      notification.open({
        message: t('unlocked'),
        description: textOf(unlock).title,
        icon: <TrophyFilled style={{ color: '#faad14' }} />
      })
    }
    socket.on('achievement-unlocked', onUnlocked)

    return () => {
      socket.off('achievement-unlocked', onUnlocked)
    }
  }, [socket, dispatch, t, textOf])

  return null
}
