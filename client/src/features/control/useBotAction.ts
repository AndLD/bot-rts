'use client'

import { useTranslations } from 'next-intl'
import { useCallback } from 'react'
import { useBotControlPerformMutation } from '../../shared/api'

export interface ActionOutcome {
  ok: boolean
  data?: unknown
  // Why it failed, in the player's language
  message?: string
}

// Does a manual action (design §15.1) of a bot: the same call a script would make, with the same answer. A refusal comes
// back as a message to show, not as an exception.
export function useBotAction(botId: string) {
  const t = useTranslations('errors')
  const [perform] = useBotControlPerformMutation()

  const messageFor = useCallback((code: string | undefined) => (code && t.has(code) ? t(code) : t('generic')), [t])

  return useCallback(
    async (fn: string, args: unknown[] = []): Promise<ActionOutcome> => {
      const response = await perform({ botId, manualActionDto: { fn, args: args as object[] } })

      if ('error' in response) {
        const code = (response.error as { data?: { code?: string } }).data?.code
        return { ok: false, message: messageFor(code) }
      }

      const { ok, data, code } = response.data
      return ok ? { ok, data } : { ok, message: messageFor(code) }
    },
    [botId, perform, messageFor]
  )
}
