import { redact, redactValue } from '../../../../lib/utils/redaction'

const JWT = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dBjftJeZ4CVPmB92K27uhbUJU1p1r_wW1gFWFOEjXk'

// The lines that must come out clean, and the lines that must come out as they went in
const REDACTED: Array<[string, string]> = [
  ['Failed login for alice@example.com from 10.0.0.1', 'Failed login for [email] from 10.0.0.1'],
  ['mail to a.b+tag@sub.example.co.uk and c@d.io', 'mail to [email] and [email]'],
  [`token ${JWT} expired`, 'token [token] expired'],
  [`Authorization: Bearer ${JWT}`, 'Authorization: Bearer [token]'],
  ['Authorization: Bearer abcdef1234567890', 'Authorization: Bearer [token]'],
  ['Authorization: Basic dXNlcjpwYXNzd29yZA==', 'Authorization: Basic [token]'],
  ['bad key botrts_AbCdEf0123456789xyz used', 'bad key [api-key] used'],
  ['password=hunter2 failed', 'password=[redacted] failed'],
  ['POST /reset?token=abc123def&x=1', 'POST /reset?token=[redacted]&x=1'],
  ['{"password":"hunter2","name":"Alice"}', '{"password":"[redacted]","name":"Alice"}'],
  ["{'apiKey': 'k-123', 'a': 1}", "{'apiKey': '[redacted]', 'a': 1}"],
  ['secret: top-secret, then more', 'secret: [redacted], then more'],
  ['api_key=abc; cookie=session-1', 'api_key=[redacted]; cookie=[redacted]'],
  ['refresh=abc.def refreshed', 'refresh=[redacted] refreshed'],
  ['PASSWORD = "x y z" end', 'PASSWORD = "[redacted]" end']
]

const UNTOUCHED = [
  'GET /api/v1/bots 200 3.1ms',
  'player 8c1b6a9e-2f4d-4c1a-9b7e-0a1b2c3d4e5f deployed bot 11111111-2222-4333-8444-555555555555',
  'trace 4bf92f3577b34da6a3ce929d0e0e4736 span 00f067aa0ba902b7',
  '{"code":"NOT_FOUND","error":"Not found"}',
  'engine tick 1234 took 12.5ms',
  'a script wrote: the token is not here, just words',
  'Authorization header missing'
]

describe('redact', () => {
  it.each(REDACTED)('takes the secret out of %s', (input, expected) => {
    expect(redact(input)).toBe(expected)
  })

  it.each(UNTOUCHED)('leaves %s as it is', (input) => {
    expect(redact(input)).toBe(input)
  })

  it('does it for every occurrence in a long line, and twice over changes nothing more', () => {
    const line = `a@b.io logged in with password=x and a@b.io again, key botrts_0123456789abcdef`
    const once = redact(line)

    expect(once).toBe('[email] logged in with password=[redacted] and [email] again, key [api-key]')
    expect(redact(once)).toBe(once)
  })
})

describe('redactValue', () => {
  it('redacts a string and leaves other values alone', () => {
    expect(redactValue('who: bob@example.com')).toBe('who: [email]')
    expect(redactValue(42)).toBe(42)
    expect(redactValue(true)).toBe(true)
  })
})
