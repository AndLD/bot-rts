// The Security page of the admin console (design §25.3)
export const SECURITY_WINDOW_HOURS = [1, 6, 24, 72, 168] as const

export type SecurityWindowHours = (typeof SECURITY_WINDOW_HOURS)[number]

export interface IFailedLoginGroup {
  // An address or an email
  key: string
  failures: number
  // For an address: how many different emails were tried from it
  distinctEmails: number
  lastAt: number
}

export interface IPlayerRef {
  _id: string
  name: string
}

export interface ISameIpGroup {
  ip: string
  accounts: IPlayerRef[]
}

export interface IMultiIpAccount extends IPlayerRef {
  ips: number
}

export interface IBotLockout {
  botId: string
  label: string | null
  ownerId: string | null
  ownerName: string | null
  failures: number
  lockedUntil: number
}

export interface ISecurityApiKey {
  _id: string
  name: string
  prefix: string
  owner: IPlayerRef
  scopes: string[]
  ratePerMinute: number
  createdAt: number
  lastUsedAt: number | null
  expiresAt: number | null
  isRevoked: boolean
  // Requests held back by the key's rate limit in the window (counted by this node)
  rateLimitHits: number
}

export interface ISuspiciousScript {
  executionId: string
  owner: IPlayerRef
  botId: string
  file: string
  // The failure code (TIME_LIMIT, MEMORY_LIMIT, SANDBOX_FAULT) and the message
  code: string
  reason: string
  endedAt: number
}

export interface IScriptConsumer {
  executionId: string
  userId: string
  botId: string
  file: string
  opsUsed: number
  ticks: number
}

export interface ISecurityOverview {
  hours: number
  failedLoginsByIp: IFailedLoginGroup[]
  failedLoginsByEmail: IFailedLoginGroup[]
  sameIpAccounts: ISameIpGroup[]
  multiIpAccounts: IMultiIpAccount[]
  botLockouts: IBotLockout[]
  apiKeys: ISecurityApiKey[]
  suspiciousScripts: ISuspiciousScript[]
  // Null when the engine does not answer
  topConsumers: IScriptConsumer[] | null
}

// What counts as an anomaly in the lists above
export const SECURITY_THRESHOLDS = {
  failuresPerKey: 5,
  accountsPerIp: 3,
  ipsPerAccount: 3
} as const
