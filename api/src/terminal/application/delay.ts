export const DELAY = Symbol('Delay')

// Lets time pass; a port so that tests do not wait
export interface Delay {
  wait(ms: number): Promise<void>
}
