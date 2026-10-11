// The expected failures of game actions, as values (design §10.3). Only misuse throws.
export const ResultCode = {
  BLOCKED: 'BLOCKED',
  EMPTY: 'EMPTY',
  GONE: 'GONE',
  NO_ENERGY: 'NO_ENERGY',
  NO_MODULE: 'NO_MODULE',
  NO_BLUEPRINT: 'NO_BLUEPRINT',
  BROKEN_MODULE: 'BROKEN_MODULE',
  NO_FUNDS: 'NO_FUNDS',
  NOT_LIVE: 'NOT_LIVE',
  BUSY: 'BUSY',
  NOT_FOUND: 'NOT_FOUND',
  TOO_LOW: 'TOO_LOW',
  TOO_HEAVY: 'TOO_HEAVY',
  EXPIRED: 'EXPIRED',
  INBOX_FULL: 'INBOX_FULL',
  OUT_OF_RANGE: 'OUT_OF_RANGE',
  COOLDOWN: 'COOLDOWN',
  NO_AMMO: 'NO_AMMO',
  NO_SIGNAL: 'NO_SIGNAL',
  NO_SPACE: 'NO_SPACE',
  FORBIDDEN: 'FORBIDDEN'
} as const

export type ResultCode = (typeof ResultCode)[keyof typeof ResultCode]

export interface Success<T> {
  ok: true
  data: T
}

export interface Failure {
  ok: false
  code: ResultCode
  msg: string
}

export type Result<T = void> = Success<T> | Failure

export function ok(): Success<void>
export function ok<T>(data: T): Success<T>
export function ok<T>(data?: T): Success<T | undefined> {
  return { ok: true, data }
}

export function fail(code: ResultCode, msg: string): Failure {
  return { ok: false, code, msg }
}
