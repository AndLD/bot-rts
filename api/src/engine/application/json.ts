import { JsonValue } from '../domain/json-value'

// Plain data for a script: undefined properties disappear and anything else that is not JSON is dropped
export function toJson(value: unknown): JsonValue {
  return JSON.parse(JSON.stringify(value ?? null)) as JsonValue
}
