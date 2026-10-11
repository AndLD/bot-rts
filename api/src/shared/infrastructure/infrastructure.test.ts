import { SeededRng } from './seeded-rng'
import { SystemClock } from './system-clock'
import { UuidIdGenerator } from './uuid-id-generator'

describe('SeededRng', () => {
  it('repeats the sequence of the same seed', () => {
    const [a, b] = [new SeededRng(42), new SeededRng(42)]

    expect([a.next(), a.next(), a.next()]).toEqual([b.next(), b.next(), b.next()])
  })

  it('differs between seeds and stays in [0, 1)', () => {
    const [a, b] = [new SeededRng(1), new SeededRng(2)]
    const values = Array.from({ length: 1000 }, () => a.next())

    expect(a.next()).not.toBe(b.next())
    expect(values.every((value) => value >= 0 && value < 1)).toBe(true)
  })
})

describe('SystemClock', () => {
  it('returns the current time', () => {
    const before = Date.now()
    const now = new SystemClock().now().getTime()

    expect(now).toBeGreaterThanOrEqual(before)
    expect(now).toBeLessThanOrEqual(Date.now())
  })
})

describe('UuidIdGenerator', () => {
  it('generates distinct UUIDs', () => {
    const ids = new UuidIdGenerator()
    const [a, b] = [ids.next(), ids.next()]

    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    expect(a).not.toBe(b)
  })
})
