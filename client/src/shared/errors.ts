'use client'

import { SerializedError } from '@reduxjs/toolkit'
import { FetchBaseQueryError } from '@reduxjs/toolkit/query'
import { useTranslations } from 'next-intl'
import { useCallback } from 'react'

interface ApiErrorBody {
  code?: string
  error?: string
}

// The message for an API failure, in the player's language: by the error code when we have a translation, otherwise the
// server's own text, otherwise a generic one
export function useErrorMessage() {
  const t = useTranslations('errors')

  return useCallback(
    (error: FetchBaseQueryError | SerializedError | undefined): string => {
      const body = (error as FetchBaseQueryError | undefined)?.data as ApiErrorBody | undefined

      if (body?.code && t.has(body.code)) {
        return t(body.code)
      }

      return body?.error ?? t('generic')
    },
    [t]
  )
}
