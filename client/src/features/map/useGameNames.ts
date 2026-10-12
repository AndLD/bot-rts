'use client'

import { useTranslations } from 'next-intl'

// The names of resources and item kinds, in the player's language
export function useGameNames() {
  const t = useTranslations('map')

  return {
    resource: (resource: string) => t(`resources.${resource}`),
    item: (type: string) => t(`items.${type}`)
  }
}
