import { API_KEY_PREFIX } from '../../../../lib/utils/interfaces/api-keys'
import type { Principal } from './auth.service'

export const API_KEY_AUTHENTICATOR = Symbol('ApiKeyAuthenticator')

// Turns an API key into the player it acts as (the second way to authenticate, next to a session token; AGENTS.md §3.3)
export interface ApiKeyAuthenticator {
  authenticate(secret: string): Promise<Principal>
}

export const looksLikeApiKey = (token: string): boolean => token.startsWith(API_KEY_PREFIX)
