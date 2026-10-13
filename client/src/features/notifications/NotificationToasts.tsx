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
// count; it already had its toast, so only the notification center shows the new count (a condition that goes on, such as a
// generator without oil, would otherwise keep a toast on the screen). Achievements have their own toast.
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
      if (incoming.category === 'achievements' || incoming.count > 1) {
        return
      }
      notification.open({
        key: incoming.id,
        message: t(`categories.${incoming.category}`),
        description: textOf(incoming)
      })
    }
    socket.on('notification', onNotification)

    return () => {
      socket.off('notification', onNotification)
    }
  }, [socket, dispatch, t, textOf])

  return null
}
