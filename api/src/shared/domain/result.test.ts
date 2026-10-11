import { fail, ok, ResultCode } from '../../../../lib/utils/result'
import { ActionFailedError, unwrap } from './result'

describe('Result', () => {
  it('carries the data of a success, or nothing', () => {
    expect(ok({ amount: 1 })).toEqual({ ok: true, data: { amount: 1 } })
    expect(ok()).toEqual({ ok: true, data: undefined })
  })

  it('carries the code and message of an expected failure', () => {
    expect(fail(ResultCode.BLOCKED, 'Cell occupied')).toEqual({ ok: false, code: 'BLOCKED', msg: 'Cell occupied' })
  })

  it('unwraps the data of a success and throws the failure of anything else', () => {
    expect(unwrap(ok(5))).toBe(5)
    expect(() => unwrap(fail(ResultCode.COOLDOWN, 'Wait'))).toThrow(ActionFailedError)
    expect(new ActionFailedError(fail(ResultCode.COOLDOWN, 'Wait'))).toMatchObject({
      statusCode: 409,
      code: 'COOLDOWN'
    })
    expect(new ActionFailedError(fail(ResultCode.FORBIDDEN, 'No'))).toMatchObject({ statusCode: 403 })
    expect(new ActionFailedError(fail(ResultCode.NOT_FOUND, 'None'))).toMatchObject({ statusCode: 404 })
  })
})
