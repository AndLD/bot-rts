export const PASSWORD_HASHER = Symbol('PasswordHasher')

export interface PasswordHasher {
  hash(password: string): Promise<string>
  verify(password: string, hash: string): Promise<boolean>
}
