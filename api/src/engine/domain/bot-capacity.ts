import { GameModule, ProcessorModule } from '../../modules/domain/game-module'

// What a bot's processors allow (design §12.2.1)
export interface BotCapacity {
  // Game-API calls per tick, summed over all its executions
  opsPerTick: number
  // How many scripts may run at the same time; the others wait queued
  parallelExecutions: number
}

export const NO_CAPACITY: BotCapacity = { opsPerTick: 0, parallelExecutions: 0 }

// The working processors add up; a bot without one cannot run scripts (design §12.2)
export function capacityOf(modules: readonly GameModule[]): BotCapacity {
  return modules
    .filter((module): module is ProcessorModule => module instanceof ProcessorModule && module.isWorking)
    .reduce(
      (total, processor) => ({
        opsPerTick: total.opsPerTick + processor.opsPerTick,
        parallelExecutions: total.parallelExecutions + processor.parallelExecutions
      }),
      NO_CAPACITY
    )
}
