export const LOG_BUFFER = Symbol('LogBuffer')

export type LogLevel = 'info' | 'warn' | 'error'

export interface LogLine {
  at: Date
  level: LogLevel
  message: string
  // The request that was being served when the line was written, if any
  requestId: string | null
}

export interface LogFilter {
  // A part of the message: where the id of a player or a bot is looked for
  text?: string
  level?: LogLevel
  requestId?: string
  from?: Date
  to?: Date
}

// The newest lines this process logged, kept in memory for the console's log search (design §25.3). The files and the console
// stay the record; this is a window onto the recent past of one node.
export class LogBuffer {
  private readonly lines: Array<LogLine | undefined>
  private next = 0
  private count = 0

  constructor(readonly capacity: number) {
    this.lines = new Array<LogLine | undefined>(capacity)
  }

  add(line: LogLine): void {
    this.lines[this.next] = line
    this.next = (this.next + 1) % this.capacity
    this.count = Math.min(this.count + 1, this.capacity)
  }

  // The newest matching lines first, and how many lines match in all
  search(filter: LogFilter, limit: number): { lines: LogLine[]; total: number } {
    const text = filter.text?.toLowerCase()
    const matches: LogLine[] = []
    let total = 0

    for (let age = 0; age < this.count; age += 1) {
      const line = this.lines[(this.next - 1 - age + this.capacity * 2) % this.capacity] as LogLine
      const isMatch =
        (!filter.level || line.level === filter.level) &&
        (!filter.requestId || line.requestId === filter.requestId) &&
        (!filter.from || line.at >= filter.from) &&
        (!filter.to || line.at <= filter.to) &&
        (!text || line.message.toLowerCase().includes(text))

      if (isMatch) {
        total += 1
        if (matches.length < limit) {
          matches.push(line)
        }
      }
    }

    return { lines: matches, total }
  }
}
