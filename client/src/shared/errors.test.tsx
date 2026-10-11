import { renderAppHook } from '../../tests/render'
import { useErrorMessage } from './errors'

describe('useErrorMessage', () => {
  it('translates a known error code', () => {
    const { result } = renderAppHook(useErrorMessage)

    expect(result.current({ code: 'USER_BANNED', message: 'server text' })).toBe('Your account is blocked')
  })

  it('shows the provider text for an unknown code', () => {
    const { result } = renderAppHook(useErrorMessage)

    expect(result.current({ code: 'SOMETHING_NEW', message: 'server text' })).toBe('server text')
  })

  it('shows the provider text when there is no code', () => {
    const { result } = renderAppHook(useErrorMessage)

    expect(result.current({ message: 'server text' })).toBe('server text')
  })

  it('shows a generic text when there is nothing else', () => {
    const { result } = renderAppHook(useErrorMessage)

    expect(result.current({})).toBe('Something went wrong')
  })
})
