'use client'

import { useCallback } from 'react'
import { useErrorMessage } from '../../shared/errors'
import { errorNotification } from '../../shared/notifications'

// Tells the admin why a request failed; returns whether it did
export function useReportFailure() {
  const getErrorMessage = useErrorMessage()

  return useCallback(
    (result: { error?: unknown }): boolean => {
      if (!result.error) {
        return false
      }
      const body = (result.error as { data?: { code?: string; error?: string } }).data
      errorNotification(getErrorMessage({ code: body?.code, message: body?.error }))

      return true
    },
    [getErrorMessage]
  )
}
