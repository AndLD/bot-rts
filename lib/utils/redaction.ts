// Takes what must not be read out of a line of the log or the attribute of a span: emails, tokens, passwords and API keys (design §25.3,
// Logs and audit; the privacy policy). Pure, so that the API, the engine and the MCP server redact alike, before a record is written
// anywhere. The collector gateway redacts again with the same patterns (`deploy/observability/otel-collector.yaml`).

interface Rule {
  pattern: RegExp
  replace: string | ((...match: string[]) => string)
}

// A value after one of these names, as `name=value`, `name: value` or `"name":"value"`
const SECRET_NAMES = 'password|passwd|pwd|secret|token|api[_-]?key|authorization|cookie|refresh|credentials?'

const RULES: readonly Rule[] = [
  // A JSON Web Token: the access token of a session
  { pattern: /\beyJ[\w-]{5,}\.[\w-]{5,}\.[\w-]*/g, replace: '[token]' },
  // The credentials of an Authorization header
  { pattern: /\b(Bearer|Basic)\s+[\w.~+/=-]{8,}/gi, replace: '$1 [token]' },
  // An API key of a player
  { pattern: /\bbotrts_[\w-]{8,}/g, replace: '[api-key]' },
  {
    pattern: new RegExp(`(["']?(?:${SECRET_NAMES})["']?\\s*[:=]\\s*)(?!(?:Bearer|Basic)\\b)("[^"]*"|'[^']*'|[^\\s,;&}"']+)`, 'gi'),
    replace: (_all, name, value) => {
      const quote = value.startsWith('"') || value.startsWith("'") ? value[0] : ''

      return `${name}${quote}[redacted]${quote}`
    }
  },
  { pattern: /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/g, replace: '[email]' }
]

export function redact(text: string): string {
  return RULES.reduce((result, { pattern, replace }) => result.replace(pattern, replace as string), text)
}

// The same for a value that may be a string or something else (a number or a boolean attribute is left as it is)
export function redactValue<T extends string | number | boolean>(value: T): T {
  return (typeof value === 'string' ? redact(value) : value) as T
}
