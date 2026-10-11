export const LOCALES = ['en', 'ru'] as const

export type Locale = (typeof LOCALES)[number]

export const DEFAULT_LOCALE: Locale = 'en'

export const LOCALE_STORAGE_KEY = 'locale'

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value)
}

interface Detection {
  // The language the player chose explicitly
  stored: string | null
  // The browser's languages in order of preference, e.g. ["ru-RU", "en"]
  languages: readonly string[]
}

// An explicit choice wins; otherwise the first browser language we support; otherwise English
export function detectLocale({ stored, languages }: Detection): Locale {
  if (isLocale(stored)) {
    return stored
  }

  for (const language of languages) {
    const primary = language.toLowerCase().split('-')[0]

    if (isLocale(primary)) {
      return primary
    }
  }

  return DEFAULT_LOCALE
}

export type Messages = { [key: string]: string | Messages }

// Missing translations fall back to the English text
export function withFallback(fallback: Messages, messages: Messages): Messages {
  const merged: Messages = { ...fallback }

  for (const [key, value] of Object.entries(messages)) {
    const base = merged[key]
    merged[key] = typeof value === 'object' && typeof base === 'object' ? withFallback(base, value) : value
  }

  return merged
}
