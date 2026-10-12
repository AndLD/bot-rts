import { Execution } from '../domain/execution'

export const EXECUTION_REPOSITORY = Symbol('ExecutionRepository')

// The durable record of every execution; the engine is its only writer (design §12.3.1)
export interface ExecutionRepository {
  add(execution: Execution): Promise<void>
  update(execution: Execution): Promise<void>
  findById(id: string): Promise<Execution | null>
  // Executions still active, oldest first: what a restarted engine relaunches
  listActive(): Promise<Execution[]>
}
