'use client'

import { useTranslations } from 'next-intl'
import { useCallback } from 'react'
import type { AuthFailure } from '../features/auth/auth-client'

// The message for a failure, in the player's language: by the error code when we have a translation, otherwise the
// provider's own text, otherwise a generic one
export function useErrorMessage() {
  const t = useTranslations('errors')

  return useCallback(
    (failure: AuthFailure): string =>
      failure.code && t.has(failure.code) ? t(failure.code) : (failure.message ?? t('generic')),
    [t]
  )
}
