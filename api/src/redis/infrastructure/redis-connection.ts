import Redis from 'ioredis'

// One Redis connection with the settings every user of it needs: a dead server must not queue commands forever
export function connectRedis(url: string): Redis {
  return new Redis(url, { maxRetriesPerRequest: 3, enableReadyCheck: true })
}
