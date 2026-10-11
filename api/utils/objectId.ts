const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i

export function isValidId(value: unknown): value is string {
  return typeof value === 'string' && OBJECT_ID_PATTERN.test(value)
}
