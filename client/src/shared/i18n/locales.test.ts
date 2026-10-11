import { DEFAULT_LOCALE, detectLocale, isLocale, withFallback } from './locales'

describe('isLocale', () => {
  it('accepts the supported languages only', () => {
    expect(isLocale('en')).toBe(true)
    expect(isLocale('ru')).toBe(true)
    expect(isLocale('de')).toBe(false)
    expect(isLocale(null)).toBe(false)
  })
})

describe('detectLocale', () => {
  it('prefers the saved choice', () => {
    expect(detectLocale({ stored: 'ru', languages: ['en-US'] })).toBe('ru')
  })

  it('ignores a saved choice we do not support', () => {
    expect(detectLocale({ stored: 'de', languages: ['ru-RU'] })).toBe('ru')
  })

  it('takes the first supported browser language, ignoring the region and the case', () => {
    expect(detectLocale({ stored: null, languages: ['de-DE', 'RU-ru', 'en'] })).toBe('ru')
  })

  it('falls back to English', () => {
    expect(detectLocale({ stored: null, languages: ['de', 'fr'] })).toBe(DEFAULT_LOCALE)
    expect(detectLocale({ stored: null, languages: [] })).toBe(DEFAULT_LOCALE)
  })
})

describe('withFallback', () => {
  it('shows the English text where a translation is missing', () => {
    const merged = withFallback({ a: 'A', group: { b: 'B', c: 'C' } }, { group: { b: 'Б' } })

    expect(merged).toEqual({ a: 'A', group: { b: 'Б', c: 'C' } })
  })

  it('takes translated leaves and keeps keys the fallback lacks', () => {
    expect(withFallback({ a: 'A' }, { a: 'Я', extra: 'E' })).toEqual({ a: 'Я', extra: 'E' })
  })

  it('lets a translated group replace a fallback text', () => {
    expect(withFallback({ a: 'A' }, { a: { b: 'B' } })).toEqual({ a: { b: 'B' } })
  })

  it('does not change the fallback', () => {
    const fallback = { group: { b: 'B' } }

    withFallback(fallback, { group: { b: 'Б' } })

    expect(fallback).toEqual({ group: { b: 'B' } })
  })
})
