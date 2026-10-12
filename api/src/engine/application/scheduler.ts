import { LiveExecution } from './live-execution'

export const SCHEDULER = Symbol('Scheduler')

// Decides which executions get to run in a tick and in what order (design §12.2)
export interface Scheduler {
  order(executions: readonly LiveExecution[], tick: number): LiveExecution[]
}

// Runs the executions in the order they were started, every tick. The fair scheduler of design §12.2 replaces it (task 5.4).
export class ArrivalOrderScheduler implements Scheduler {
  order(executions: readonly LiveExecution[]): LiveExecution[] {
    return [...executions]
  }
}
