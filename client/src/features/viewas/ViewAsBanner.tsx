'use client'

import { Alert, Button } from 'antd'
import { useFormatter, useTranslations } from 'next-intl'
import { useCallback, useEffect, useState } from 'react'
import { useViewAsExitMutation } from '../../shared/api'
import { useAppDispatch } from '../../shared/store/hooks'
import { setToken } from '../../shared/store/session.slice'
import { clearViewAs, readViewAs, ViewAsInfo } from './view-as-storage'

// Shown on every screen of a "view as player" tab (design §25.2): whose game this is, that it is read-only, when it ends, and the
// way out. It renders nothing in an ordinary tab.
export default function ViewAsBanner() {
  const t = useTranslations('viewAs')
  const format = useFormatter()
  const dispatch = useAppDispatch()
  const [exitView, { isLoading }] = useViewAsExitMutation()
  const [view, setView] = useState<ViewAsInfo | null>(null)

  useEffect(() => setView(readViewAs()), [])

  // Leaves the tab: the token is dropped first, so nothing in it can act again, then the tab closes (or goes back to the console)
  const leave = useCallback(() => {
    dispatch(setToken(null))
    clearViewAs()
    window.close()
    window.location.assign('/admin/players')
  }, [dispatch])

  useEffect(() => {
    if (!view) {
      return
    }
    const timer = setTimeout(leave, Math.max(view.expiresAt - Date.now(), 0))

    return () => clearTimeout(timer)
  }, [view, leave])

  if (!view) {
    return null
  }

  return (
    <Alert
      banner
      type="warning"
      role="status"
      message={t('banner', { name: view.playerName })}
      description={t('ends', {
        time: format.dateTime(new Date(view.expiresAt), { timeStyle: 'short' })
      })}
      action={
        <Button
          size="small"
          loading={isLoading}
          onClick={async () => {
            // The server ends the session; a failed call still leaves the tab, and the time limit ends the session anyway
            await exitView()
            leave()
          }}
        >
          {t('exit')}
        </Button>
      }
    />
  )
}
