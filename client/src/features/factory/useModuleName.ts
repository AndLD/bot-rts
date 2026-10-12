'use client'

import { useTranslations } from 'next-intl'

// "scanner-class2" as "Scanner, class 2" in the player's language; a module without a translation shows its own name
export function useModuleName() {
  const t = useTranslations('modules')

  return (module: string) => {
    const match = /^(.+)-class(\d+)$/.exec(module)

    return match && t.has(`types.${match[1]}`)
      ? t('named', { type: t(`types.${match[1]}`), level: Number(match[2]) })
      : module
  }
}
