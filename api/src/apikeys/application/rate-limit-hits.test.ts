import { RateLimitHits } from './rate-limit-hits'

describe('RateLimitHits', () => {
  it('counts the hits of each key since a moment, and forgets the older ones', () => {
    const hits = new RateLimitHits()
    hits.record('a', 1000)
    hits.record('a', 3000)
    hits.record('b', 500)

    expect(hits.since(2000)).toEqual(new Map([['a', 1]]))
    expect(hits.since(0)).toEqual(new Map([['a', 1]]))
    expect(hits.since(10_000)).toEqual(new Map())
  })

  it('keeps the newest thousand hits of a key', () => {
    const hits = new RateLimitHits()
    for (let at = 0; at < 1200; at += 1) hits.record('a', at)

    expect(hits.since(0).get('a')).toBe(1000)
  })
})
