import { useTranslations } from 'next-intl'
import { useCallback } from 'react'

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X']

interface Described {
  family: string
  level: number
  levels: number
  threshold: number
}

// The title and the description of an achievement in the player's language: the texts belong to its family, a family of several
// levels shows the level in the title, and the description says what the threshold of the level is
export function useAchievementText() {
  const t = useTranslations('achievements')

  return useCallback(
    ({ family, level, levels, threshold }: Described) => ({
      title: levels > 1 ? `${t(`families.${family}.title`)} ${ROMAN[level] ?? level}` : t(`families.${family}.title`),
      description: t(`families.${family}.description`, { count: threshold })
    }),
    [t]
  )
}
