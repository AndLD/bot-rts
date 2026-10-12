import { act } from '@testing-library/react'
import { makeJwt } from '../../../tests/jwt'
import { renderAppHook, storeWithToken } from '../../../tests/render'
import { baseQueryWithRefresh } from '../../shared/store/baseQuery'
import { useBotAction } from './useBotAction'

jest.mock('../../shared/store/baseQuery', () => ({ baseQueryWithRefresh: jest.fn() }))
const query = jest.mocked(baseQueryWithRefresh)

function setup() {
  return renderAppHook(() => useBotAction('b1'), { store: storeWithToken(makeJwt(60)) })
}

describe('useBotAction', () => {
  beforeEach(() => query.mockReset())

  it('does the action and gives back what the call returned', async () => {
    query.mockResolvedValue({ data: { ok: true, data: { id: 'i1' } } })
    const { result } = setup()

    const outcome = await act(() => result.current('take'))

    expect(outcome).toEqual({ ok: true, data: { id: 'i1' } })
    expect(query).toHaveBeenCalledWith(
      expect.objectContaining({ url: '/api/v1/bots/b1/actions', body: { fn: 'take', args: [] } }),
      expect.anything(),
      undefined
    )
  })

  it('passes the arguments', async () => {
    query.mockResolvedValue({ data: { ok: true } })
    const { result } = setup()

    await act(() => result.current('drop', [3, 4]))

    expect(query).toHaveBeenCalledWith(
      expect.objectContaining({ body: { fn: 'drop', args: [3, 4] } }),
      expect.anything(),
      undefined
    )
  })

  it('says why a call failed, in words', async () => {
    query.mockResolvedValue({ data: { ok: false, code: 'BLOCKED', msg: 'The cell is occupied' } })
    const { result } = setup()

    expect(await act(() => result.current('drop'))).toEqual({ ok: false, message: 'The way is blocked' })
  })

  it('says why a request was refused, and falls back to a general message', async () => {
    const { result } = setup()

    query.mockResolvedValueOnce({ error: { status: 409, data: { code: 'NO_SIGNAL' } } })
    expect(await act(() => result.current('scan'))).toEqual({ ok: false, message: 'No signal' })

    query.mockResolvedValueOnce({ error: { status: 500, data: {} } })
    expect(await act(() => result.current('scan'))).toEqual({ ok: false, message: 'Something went wrong' })

    query.mockResolvedValueOnce({ data: { ok: false, code: 'NOT_A_CODE' } })
    expect(await act(() => result.current('scan'))).toEqual({ ok: false, message: 'Something went wrong' })
  })
})
