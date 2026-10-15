'use client'

import { useCallback } from 'react'
import { API_URL } from '../../shared/config'
import { useErrorMessage } from '../../shared/errors'
import { errorNotification } from '../../shared/notifications'
import { useToken } from '../../shared/store/hooks'

// Downloads a CSV of the console as a file: the request carries the token of the session, so it cannot be a plain link. A refusal is
// told to the admin.
export function useCsvDownload() {
  const token = useToken()
  const getErrorMessage = useErrorMessage()

  return useCallback(
    async (path: string, filename: string) => {
      const response = await fetch(`${API_URL}${path}`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include'
      })

      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { code?: string; error?: string }
        errorNotification(getErrorMessage({ code: body.code, message: body.error }))
        return
      }
      const url = URL.createObjectURL(await response.blob())
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      link.click()
      URL.revokeObjectURL(url)
    },
    [token, getErrorMessage]
  )
}
