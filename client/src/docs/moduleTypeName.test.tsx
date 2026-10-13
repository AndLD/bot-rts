import { renderHook } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { ReactNode } from 'react'
import en from '../../messages/en.json'
import { useModuleTypeName } from './useModuleTypeName'

const wrapper = ({ children }: { children: ReactNode }) => (
  <NextIntlClientProvider locale="en" messages={en} timeZone="UTC">
    {children}
  </NextIntlClientProvider>
)

describe('useModuleTypeName', () => {
  it('names a module type as the part the player knows, and keeps a type it has no name for', () => {
    const { result } = renderHook(() => useModuleTypeName(), { wrapper })

    expect(result.current('mining')).toBe('Drill')
    expect(result.current('wirelessAdapter')).toBe('Wireless adapter')
    expect(result.current('mystery')).toBe('mystery')
  })
})
