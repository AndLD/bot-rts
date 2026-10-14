export const KEY_SECRETS = Symbol('KeySecrets')

export interface KeySecrets {
  // A new random key, with the `botrts_` prefix that tells it from a session token
  generate(): string
  // The one-way hash under which a key is stored and looked up
  hash(secret: string): string
}
