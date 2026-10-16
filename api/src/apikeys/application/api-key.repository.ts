import { ApiKey } from '../domain/api-key'

export const API_KEY_REPOSITORY = Symbol('ApiKeyRepository')

export interface ApiKeyRepository {
  add(key: ApiKey): Promise<void>
  findByHash(keyHash: string): Promise<ApiKey | null>
  findById(id: string): Promise<ApiKey | null>
  // A player key of the user; an admin key is never found here, so a player's routes cannot reach it
  findOfUser(userId: string, id: string): Promise<ApiKey | null>
  // The player's own keys, newest first, revoked ones included; admin keys are never in it
  listOfUser(userId: string): Promise<ApiKey[]>
  // Player keys that are neither revoked nor expired
  countActiveOfUser(userId: string, now: Date): Promise<number>
  // Admin keys of the console, newest first, revoked ones included
  listAdminKeys(): Promise<ApiKey[]>
  countActiveAdminKeysOfUser(userId: string, now: Date): Promise<number>
  revoke(id: string, at: Date): Promise<void>
  touch(id: string, at: Date): Promise<void>
}
