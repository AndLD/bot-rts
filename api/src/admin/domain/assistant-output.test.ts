import { ADMIN_API_KEY_LIMITS } from '../../../../lib/utils/admin-api-keys'
import { shapeForAssistant, TRUNCATION_MARK } from './assistant-output'

const JWT = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dBjftJeZ4CVPmB92K27uhbUJU1p1r_wW1gFWFOEjXk'
const SECRETS = ['alice@example.com', 'hunter2', 'botrts_0123456789abcdef', 'abcdef1234567890xyz', JWT]
const DIRTY = `login of alice@example.com with password=hunter2, key botrts_0123456789abcdef, Bearer abcdef1234567890xyz, token ${JWT}`

describe('shapeForAssistant', () => {
  it('takes personal data and secrets out of every string, at any depth', () => {
    const body = { lines: [{ message: DIRTY, nested: { note: DIRTY } }], total: 1, ok: true, none: null }

    const shaped = JSON.stringify(shapeForAssistant(body))

    for (const secret of SECRETS) expect(shaped).not.toContain(secret)
    expect(shapeForAssistant(body)).toMatchObject({ total: 1, ok: true, none: null })
  })

  it('cuts a long string that a player wrote and marks the cut', () => {
    const { text } = shapeForAssistant({ text: 'x'.repeat(ADMIN_API_KEY_LIMITS.responseStringMaxLength + 50) })

    expect(text).toHaveLength(ADMIN_API_KEY_LIMITS.responseStringMaxLength + TRUNCATION_MARK.length)
    expect(text.endsWith(TRUNCATION_MARK)).toBe(true)
    expect(shapeForAssistant({ text: 'short' })).toEqual({ text: 'short' })
  })

  it('refuses an answer over the size cap, telling the caller to narrow the query', () => {
    const rows = Array.from({ length: 400 }, () => 'y'.repeat(ADMIN_API_KEY_LIMITS.responseStringMaxLength))

    expect(() => shapeForAssistant(rows)).toThrow('narrow the query')
    expect(() => shapeForAssistant(rows)).toThrow(expect.objectContaining({ statusCode: 413 }))
  })

  it('lets an empty answer through', () => {
    expect(shapeForAssistant(undefined)).toBeUndefined()
  })
})
