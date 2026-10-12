// A window between the engine thread and the thread that supervises it (plan 5.7): the engine writes which execution it is
// running before every step of a script and clears it after, and the supervisor reads it from outside. The sandbox checks
// its clock only every few thousand instructions, so a script whose every instruction is a heavy builtin (sorting a big array
// in a loop, say) can overrun its slice by many seconds; only a thread that is not stuck behind it can notice and act.
const SLOT_COUNT = 36
const HEADER = 1
const BYTES = (HEADER + SLOT_COUNT) * Int32Array.BYTES_PER_ELEMENT

export const createStepWatchBuffer = (): SharedArrayBuffer => new SharedArrayBuffer(BYTES)

export interface StepWatch {
  begin(executionId: string): void
  end(): void
}

// The engine's side
export class StepWatchWriter implements StepWatch {
  private readonly cells: Int32Array

  constructor(buffer: SharedArrayBuffer) {
    this.cells = new Int32Array(buffer)
  }

  // An odd sequence number means a step is running
  begin(executionId: string): void {
    for (let i = 0; i < SLOT_COUNT; i++) {
      Atomics.store(this.cells, HEADER + i, executionId.charCodeAt(i) || 0)
    }
    Atomics.add(this.cells, 0, 1)
  }

  end(): void {
    Atomics.add(this.cells, 0, 1)
  }
}

export interface StepState {
  // Changes with every begin and every end
  readonly sequence: number
  // The execution being stepped, or null between steps
  readonly executionId: string | null
}

// The supervisor's side
export class StepWatchReader {
  private readonly cells: Int32Array

  constructor(buffer: SharedArrayBuffer) {
    this.cells = new Int32Array(buffer)
  }

  // The step that was running is over, because its thread is gone: the next engine must not be judged by what the last left
  clear(): void {
    const sequence = Atomics.load(this.cells, 0)
    if (sequence % 2 === 1) {
      Atomics.store(this.cells, 0, sequence + 1)
    }
  }

  read(): StepState {
    const sequence = Atomics.load(this.cells, 0)
    if (sequence % 2 === 0) {
      return { sequence, executionId: null }
    }
    let id = ''
    for (let i = 0; i < SLOT_COUNT; i++) {
      const code = Atomics.load(this.cells, HEADER + i)
      id += code ? String.fromCharCode(code) : ''
    }
    return { sequence, executionId: id }
  }
}
