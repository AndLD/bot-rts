import { Delay } from '../application/delay'

export class SystemDelay implements Delay {
  wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}
