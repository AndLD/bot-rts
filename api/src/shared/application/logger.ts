export const LOGGER = Symbol('Logger')

export interface Logger {
  info(message: string): void
  warn(message: string): void
  error(error: unknown): void
}
