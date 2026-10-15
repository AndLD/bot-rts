// How long terminal logs are kept (design §11.2.3); tunable configuration
export interface TerminalRetention {
  // Ordinary lines (input, output, errors) older than this are dropped
  logDays: number
  // At most this many ordinary lines are kept per bot, the oldest dropped first
  maxLinesPerBot: number
  // Security events are kept longer than ordinary lines
  securityDays: number
}

export const TERMINAL_RETENTION = Symbol('TerminalRetention')

export const DEFAULT_TERMINAL_RETENTION: TerminalRetention = { logDays: 30, maxLinesPerBot: 5000, securityDays: 90 }

// The retention in force, read on every use: the values can be changed in the admin console while the server runs
export function liveTerminalRetention(policy: {
  snapshot(): { terminalLogs: Record<string, number | boolean> }
}): TerminalRetention {
  const values = () => policy.snapshot().terminalLogs

  return {
    get logDays() {
      return values().logDays as number
    },
    get maxLinesPerBot() {
      return values().maxLinesPerBot as number
    },
    get securityDays() {
      return values().securityDays as number
    }
  }
}
