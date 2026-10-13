'use client'

import { INotification } from '@lib/utils/interfaces/notifications'
import { notification } from 'antd'
import { useTranslations } from 'next-intl'
import { useEffect } from 'react'
import { api } from '../../shared/api'
import { useSocket } from '../../shared/socket/socket-context'
import { useAppDispatch } from '../../shared/store/hooks'
import { useNotificationText } from './useNotificationText'

// Tells the player of what the server pushes (design §24.2). A notification that was coalesced arrives again with a higher
// count and the same key, so its toast is updated and not repeated. Achievements have their own toast.
export default function NotificationToasts() {
  const t = useTranslations('notifications')
  const textOf = useNotificationText()
  const socket = useSocket()
  const dispatch = useAppDispatch()

  useEffect(() => {
    if (!socket) {
      return
    }
    const onNotification = (incoming: INotification) => {
      dispatch(api.util.invalidateTags(['Notifications']))
      if (incoming.category === 'achievements') {
        return
      }
      notification.open({
        key: incoming.id,
        message: t(`categories.${incoming.category}`),
        description:
          incoming.count > 1 ? `${textOf(incoming)} ${t('times', { count: incoming.count })}` : textOf(incoming)
      })
    }
    socket.on('notification', onNotification)

    return () => {
      socket.off('notification', onNotification)
    }
  }, [socket, dispatch, t, textOf])

  return null
}
