'use client'

import { INotification } from '@lib/utils/interfaces/notifications'
import { Badge, Button, Switch } from 'antd'
import { useFormatter, useNow, useTranslations } from 'next-intl'
import { useMemo, useState } from 'react'
import {
  useLazyNotificationsListQuery,
  useNotificationsListQuery,
  useNotificationsMarkReadMutation
} from '../../shared/api'
import { useNotificationText } from './useNotificationText'
import './NotificationCenter.scss'

const PAGE_SIZE = 30
// `now` is only refreshed this often, so a notification that arrived since is never shown as in the future
const RELATIVE_TIME_REFRESH_MS = 30_000

// The notification center (design §24.2): what the game told the player, newest first, with the unread ones marked. Clicking a
// notification marks it as read. Older pages are loaded on request.
export default function NotificationCenter() {
  const t = useTranslations('notifications')
  const format = useFormatter()
  const now = useNow({ updateInterval: RELATIVE_TIME_REFRESH_MS })
  const textOf = useNotificationText()
  const [isUnreadOnly, setUnreadOnly] = useState(false)
  const { data, isError } = useNotificationsListQuery({ limit: PAGE_SIZE, unread: isUnreadOnly || undefined })
  const [loadOlder, { isFetching }] = useLazyNotificationsListQuery()
  const [markRead] = useNotificationsMarkReadMutation()
  // The pages loaded after the first; the first one is kept fresh by the query, which the pushes make stale
  const [older, setOlder] = useState<INotification[]>([])
  const [isEnd, setEnd] = useState(false)

  const items = useMemo(() => {
    const first = data?.items ?? []
    const known = new Set(first.map((item) => item.id))

    return [...first, ...older.filter((item) => !known.has(item.id))]
  }, [data, older])

  if (isError) {
    return <div className="notification-center">{t('loadFailed')}</div>
  }
  if (!data) {
    return <div className="notification-center">{t('loading')}</div>
  }

  async function showOlder() {
    const last = items[items.length - 1]
    const page = await loadOlder({
      limit: PAGE_SIZE,
      before: last.createdAt,
      unread: isUnreadOnly || undefined
    }).unwrap()

    setOlder((current) => [...current, ...page.items])
    setEnd(page.items.length < PAGE_SIZE)
  }

  const canLoadMore = !isEnd && items.length >= PAGE_SIZE

  return (
    <div className="notification-center">
      <div className="notification-tools">
        <span>{t('unreadCount', { count: data.unread })}</span>
        <label>
          <Switch
            size="small"
            checked={isUnreadOnly}
            onChange={(isOn) => {
              setUnreadOnly(isOn)
              setOlder([])
              setEnd(false)
            }}
          />{' '}
          {t('unreadOnly')}
        </label>
        <Button size="small" disabled={data.unread === 0} onClick={() => markRead({ markReadDto: {} })}>
          {t('markAllRead')}
        </Button>
      </div>
      {items.length === 0 ? (
        <p>{t('empty')}</p>
      ) : (
        <ul>
          {items.map((item) => (
            <li key={item.id} className={item.readAt === null ? 'is-unread' : undefined}>
              <button
                type="button"
                onClick={() => item.readAt === null && markRead({ markReadDto: { ids: [item.id] } })}
              >
                <Badge dot={item.readAt === null} offset={[-2, 2]}>
                  <span className="notification-category">{t(`categories.${item.category}`)}</span>
                </Badge>
                <span className="notification-text">
                  {textOf(item)}
                  {item.count > 1 && <strong> {t('times', { count: item.count })}</strong>}
                </span>
                <small>{format.relativeTime(item.createdAt, Math.max(now.getTime(), item.createdAt))}</small>
              </button>
            </li>
          ))}
        </ul>
      )}
      {canLoadMore && (
        <Button size="small" loading={isFetching} onClick={showOlder}>
          {t('loadMore')}
        </Button>
      )}
    </div>
  )
}
