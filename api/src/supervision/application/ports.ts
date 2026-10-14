export const SUPERVISION_READ_MODEL = Symbol('SupervisionReadModel')

export interface ActiveExecution {
  id: string
  userId: string
  botId: string
}

// What the Supervision page reads of the executions: the engine keeps the live ones, the database says which are active
export interface SupervisionReadModel {
  findActive(executionId: string): Promise<ActiveExecution | null>
  countActive(): Promise<number>
  countActiveOf(userIds: readonly string[]): Promise<number>
}
