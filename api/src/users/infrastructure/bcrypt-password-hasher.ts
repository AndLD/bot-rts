import bcrypt from 'bcrypt'
import { PasswordHasher } from '../application/password-hasher'

const ROUNDS = 10

export class BcryptPasswordHasher implements PasswordHasher {
  hash(password: string): Promise<string> {
    return bcrypt.hash(password, ROUNDS)
  }

  verify(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash)
  }
}
