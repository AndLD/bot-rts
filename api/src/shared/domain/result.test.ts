import { fail, ok, ResultCode } from '../../../../lib/utils/result'

describe('Result', () => {
  it('carries the data of a success, or nothing', () => {
    expect(ok({ amount: 1 })).toEqual({ ok: true, data: { amount: 1 } })
    expect(ok()).toEqual({ ok: true, data: undefined })
  })

  it('carries the code and message of an expected failure', () => {
    expect(fail(ResultCode.BLOCKED, 'Cell occupied')).toEqual({ ok: false, code: 'BLOCKED', msg: 'Cell occupied' })
  })
})
