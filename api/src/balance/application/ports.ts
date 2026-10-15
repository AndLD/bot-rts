import { IBalanceDocument } from '../../../../lib/utils/admin-balance'

export const BALANCE_REPOSITORY = Symbol('BalanceRepository')
export const ECONOMY_READ_MODEL = Symbol('EconomyReadModel')

export interface BalanceVersionRecord {
  version: number
  document: IBalanceDocument
  reason: string
  createdBy: string
  createdAt: Date
}

export interface BalanceRepository {
  // Newest first, documents included
  list(): Promise<BalanceVersionRecord[]>
  find(version: number): Promise<BalanceVersionRecord | null>
  // Stores a new version and makes it the active one, in one transaction
  addAndActivate(input: Omit<BalanceVersionRecord, 'version'>): Promise<BalanceVersionRecord>
  activeVersion(): Promise<number | null>
}

export interface DepositTotals {
  resource: string
  deposits: number
  remaining: number
}

// What the economy page reads of the world: the deposits, what is carried, the blueprints learned and the modules that exist
export interface EconomyReadModel {
  deposits(): Promise<DepositTotals[]>
  stored(): Promise<Array<{ resource: string; amount: number }>>
  blueprints(): Promise<Array<{ module: string; source: string; players: number }>>
  modules(): Promise<Array<{ type: string; name: string; count: number }>>
}
