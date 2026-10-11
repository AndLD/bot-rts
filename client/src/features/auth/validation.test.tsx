import { PASSWORD_PATTERN } from '@lib/utils/validation'
import { renderAppHook } from '../../../tests/render'
import { useAuthRules } from './validation'

describe('useAuthRules', () => {
  it('has translated messages', () => {
    const { result } = renderAppHook(useAuthRules)

    expect(result.current.emailRequired.message).toBe('Please enter your email!')
    expect(result.current.nameRequired.required).toBe(true)
    expect(result.current.email.type).toBe('email')
  })

  it('lists the allowed special characters in the password message', () => {
    const { result } = renderAppHook(useAuthRules)

    expect(result.current.password.pattern).toBe(PASSWORD_PATTERN)
    expect(result.current.password.message).toContain('-#$.%&@(){}[]!?+*')
  })
})
