import Redis from 'ioredis'

type Listener = (channel: Buffer, payload: Buffer) => void

// The publish/subscribe part of Redis, in memory, so that tests of the link between nodes need no server: payloads are Buffers
// and are copied, as on the wire
export class RedisBus {
  private readonly subscribers = new Map<string, Set<Listener>>()

  connection(): Redis {
    const listeners = new Set<Listener>()
    const subscribers = this.subscribers

    return {
      on: (_event: string, listener: Listener) => void listeners.add(listener),
      subscribe: async (channel: string) => {
        const set = subscribers.get(channel) ?? new Set<Listener>()
        listeners.forEach((listener) => set.add(listener))
        subscribers.set(channel, set)
      },
      publish: async (channel: string, payload: Buffer) => {
        const set = subscribers.get(channel) ?? new Set<Listener>()
        set.forEach((listener) => queueMicrotask(() => listener(Buffer.from(channel), Buffer.from(payload))))
        return set.size
      }
    } as unknown as Redis
  }
}
