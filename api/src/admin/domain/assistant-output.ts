import { ADMIN_API_KEY_LIMITS } from '../../../../lib/utils/admin-api-keys'
import { redact } from '../../../../lib/utils/redaction'
import { PayloadTooLargeError } from '../../shared/domain/errors'

export const TRUNCATION_MARK = '…[truncated]'

function shape(value: unknown): unknown {
  if (typeof value === 'string') {
    const clean = redact(value)
    const max = ADMIN_API_KEY_LIMITS.responseStringMaxLength

    return clean.length > max ? `${clean.slice(0, max)}${TRUNCATION_MARK}` : clean
  }
  if (Array.isArray(value)) {
    return value.map(shape)
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([name, item]) => [name, shape(item)]))
  }

  return value
}

// What an admin API key may be given back (design §25.2). Log lines and script output are written by players and go to an AI, so every
// string is redacted again (the API, not the MCP server, is the one that does it), long strings are cut, and an answer that is still
// too big is refused with the advice to narrow the query.
export function shapeForAssistant<T>(body: T): T {
  const shaped = shape(body)

  if (JSON.stringify(shaped ?? null).length > ADMIN_API_KEY_LIMITS.responseMaxBytes) {
    throw new PayloadTooLargeError(
      'The answer is too large for an API key; narrow the query (a shorter range or fewer results)'
    )
  }

  return shaped as T
}
