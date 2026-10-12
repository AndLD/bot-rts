'use client'

import { ManualCategory } from '@lib/utils/interfaces/settings'
import { useTranslations } from 'next-intl'

// The names of the categories of manual control, in the player's language
export function useCategoryNames() {
  const t = useTranslations('settings')

  return (category: ManualCategory) => t(`categories.${category}`)
}
