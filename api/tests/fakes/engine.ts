import { Execution, ExecutionStatus } from '../../src/engine/domain/execution'
import { BotState } from '../../src/engine/domain/bot-state'
import { BotStateSource, EngineEvent, EngineSink, ScriptSource } from '../../src/engine/application/engine-ports'
import { ExecutionRepository } from '../../src/engine/application/execution.repository'
import { PendingCall, ScriptExecution, StepOutcome } from '../../src/engine/application/script-runtime'
import { NotFoundError } from '../../src/shared/domain/errors'

export class InMemoryExecutionRepository implements ExecutionRepository {
  readonly items = new Map<string, Execution>()

  async add(execution: Execution) {
    this.items.set(execution.id, execution)
  }

  async update(execution: Execution) {
    this.items.set(execution.id, execution)
  }

  async findById(id: string) {
    return this.items.get(id) ?? null
  }

  async listActive() {
    return [...this.items.values()].filter((execution) => execution.status === ExecutionStatus.ACTIVE)
  }
}

export class FakeBotStateSource implements BotStateSource {
  readonly states = new Map<string, BotState>()

  async load(botId: string) {
    return this.states.get(botId) ?? null
  }

  async loadControlled(userId: string, botId: string) {
    const state = this.states.get(botId)
    if (!state || state.ownerId !== userId) {
      throw new NotFoundError('Bot not found')
    }
    return state
  }
}

export class FakeScriptSource implements ScriptSource {
  readonly files = new Map<string, string>()

  async read(_userId: string, _botId: string, path: string) {
    const source = this.files.get(path)
    if (source === undefined) {
      throw new NotFoundError('File not found')
    }
    return source
  }
}

export class RecordingSink implements EngineSink {
  readonly events: EngineEvent[] = []

  emit(event: EngineEvent) {
    this.events.push(event)
  }

  logs(executionId?: string): string[] {
    return this.events
      .filter((event) => event.type === 'log' && (!executionId || event.executionId === executionId))
      .map((event) => (event.type === 'log' ? event.text : ''))
  }
}

// A script sandbox the test drives by hand
export class FakeScript implements ScriptExecution {
  calls: PendingCall[] = []
  ready = false
  settled: string[] = []
  outcome: StepOutcome = { status: 'waiting' }

  step() {
    return this.outcome
  }
  takeCalls() {
    return this.calls.splice(0)
  }
  resolveCall(callId: number, value: unknown) {
    this.settled.push(`resolve ${callId} ${JSON.stringify(value)}`)
  }
  rejectCall(callId: number, message: string) {
    this.settled.push(`reject ${callId} ${message}`)
  }
  hasReadyWork() {
    return this.ready
  }
  memoryBytes() {
    return 5
  }
  dispose() {
    this.settled.push('disposed')
  }
}
