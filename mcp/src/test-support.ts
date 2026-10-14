import type { Fetch } from './api-client'

export interface Recorded {
  method: string
  url: string
  headers: Record<string, string>
  body: unknown
}

// A stand-in for the game's API: records each request and answers with what the test says
export function fakeApi(
  answer: (request: Recorded) => { status?: number; body?: unknown } = () => ({ body: { ok: true } })
) {
  const calls: Recorded[] = []
  const fetchImpl: Fetch = async (input, init) => {
    const request: Recorded = {
      method: init?.method ?? 'GET',
      url: String(input),
      headers: (init?.headers ?? {}) as Record<string, string>,
      body: init?.body ? JSON.parse(String(init.body)) : undefined
    }
    calls.push(request)
    const { status = 200, body } = answer(request)

    const text = body === undefined ? null : typeof body === 'string' ? body : JSON.stringify(body)

    return new Response(status === 204 ? null : text, { status })
  }

  return { calls, fetchImpl }
}
