import {
  IBotLockout,
  IFailedLoginGroup,
  IMultiIpAccount,
  ISameIpGroup,
  ISuspiciousScript
} from '../../../../lib/utils/admin-security'

export const SECURITY_READ_MODEL = Symbol('SecurityReadModel')

export interface KeyRow {
  id: string
  name: string
  prefix: string
  scopes: string[]
  ratePerMinute: number
  createdAt: Date
  lastUsedAt: Date | null
  expiresAt: Date | null
  revokedAt: Date | null
  owner: { id: string; name: string }
}

// What the security page reads of the logins, the bots, the keys and the executions (one query shape per need)
export interface SecurityReadModel {
  failedLoginsByIp(since: Date, limit: number): Promise<IFailedLoginGroup[]>
  failedLoginsByEmail(since: Date, limit: number): Promise<IFailedLoginGroup[]>
  // Addresses that successful sign-ins of at least `min` different accounts came from
  sameIpAccounts(since: Date, min: number, limit: number): Promise<ISameIpGroup[]>
  // Accounts that signed in from at least `min` different addresses
  multiIpAccounts(since: Date, min: number, limit: number): Promise<IMultiIpAccount[]>
  botLockouts(now: Date, limit: number): Promise<IBotLockout[]>
  // The keys used most recently first
  apiKeys(limit: number): Promise<KeyRow[]>
  // Scripts the sandbox ended for one of the failure codes
  failedScripts(since: Date, codes: readonly string[], limit: number): Promise<Array<Omit<ISuspiciousScript, 'code'>>>
}
