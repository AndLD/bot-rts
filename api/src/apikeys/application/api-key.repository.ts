import { ApiKey } from '../domain/api-key'

export const API_KEY_REPOSITORY = Symbol('ApiKeyRepository')

export interface ApiKeyRepository {
  add(key: ApiKey): Promise<void>
  findByHash(keyHash: string): Promise<ApiKey | null>
  findById(id: string): Promise<ApiKey | null>
  findOfUser(userId: string, id: string): Promise<ApiKey | null>
  // Newest first, revoked ones included
  listOfUser(userId: string): Promise<ApiKey[]>
  // Keys that are neither revoked nor expired
  countActiveOfUser(userId: string, now: Date): Promise<number>
  revoke(id: string, at: Date): Promise<void>
  touch(id: string, at: Date): Promise<void>
}
