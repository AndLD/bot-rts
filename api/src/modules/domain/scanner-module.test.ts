import { buildModule } from '../../../tests/integration/builders'
import { ScannerModule } from './scanner-module'

const scanner = (props: Record<string, unknown> = {}, overrides = {}) =>
  new ScannerModule(buildModule('bot', { type: 'scanner', operationCost: 1, props, ...overrides }))

describe('ScannerModule', () => {
  it('covers a square around the bot and charges for every cell of it', () => {
    expect(scanner({ distance: 1 })).toMatchObject({ area: 9, energyCost: 9 })
    expect(scanner({ distance: 3 })).toMatchObject({ area: 49, energyCost: 49 })
    expect(scanner({ distance: 0 })).toMatchObject({ area: 1, energyCost: 1 })
  })

  it('allows a scan and starts the cooldown', () => {
    expect(scanner({ delay: 250 }).scan(1000)).toEqual({ ok: true, data: { patch: { readyAt: 1250 } } })
  })

  it('refuses a scan during the cooldown, until it is over', () => {
    const waiting = scanner({ delay: 250, readyAt: 1250 })

    expect(waiting.scan(1249)).toMatchObject({ ok: false, code: 'COOLDOWN' })
    expect(waiting.scan(1250)).toMatchObject({ ok: true })
  })

  it('refuses a scan when broken or live', () => {
    expect(scanner({}, { condition: 0 }).scan(0)).toMatchObject({ code: 'BROKEN_MODULE' })
    expect(scanner({ isLive: true }).scan(0)).toMatchObject({ code: 'BUSY' })
  })

  it('switches between the one-time and the live mode', () => {
    expect(scanner().isLive).toBe(false)
    expect(scanner().enable()).toEqual({ ok: true, data: { patch: { isLive: true } } })
    expect(scanner({}, { condition: 0 }).enable()).toMatchObject({ code: 'BROKEN_MODULE' })
    expect(scanner({ isLive: true }).disable()).toEqual({ patch: { isLive: false } })
    expect(scanner({ isLive: true }, { condition: 0 }).disable()).toEqual({ patch: { isLive: false } })
  })

  it('offers the live view only while live', () => {
    expect(scanner({ isLive: true }).view()).toEqual({ ok: true, data: undefined })
    expect(scanner().view()).toMatchObject({ code: 'NOT_LIVE' })
    expect(scanner({ isLive: true }, { condition: 0 }).view()).toMatchObject({ code: 'BROKEN_MODULE' })
  })
})
