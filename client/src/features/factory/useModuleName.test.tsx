import { renderAppHook } from '../../../tests/render'
import { useModuleName } from './useModuleName'

describe('useModuleName', () => {
  it('names a module by its type and class', () => {
    const { result } = renderAppHook(() => useModuleName())

    expect(result.current('scanner-class2')).toBe('Scanner, class 2')
    expect(result.current('wireless-adapter-class1')).toBe('Wireless adapter, class 1')
  })

  it('shows the name of a module it has no words for', () => {
    const { result } = renderAppHook(() => useModuleName())

    expect(result.current('laser-class1')).toBe('laser-class1')
    expect(result.current('mystery')).toBe('mystery')
  })
})
