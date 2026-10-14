// The only way this package reaches the game: the public API (/api/v1) with an API key. It has no other access.

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export type Fetch = typeof fetch

type Query = Record<string, string | number | boolean | undefined>

export class ApiClient {
  constructor(
    private readonly apiUrl: string,
    private readonly apiKey: string,
    private readonly fetchImpl: Fetch = fetch
  ) {}

  get<T = unknown>(path: string, query?: Query): Promise<T> {
    return this.request('GET', path, { query })
  }

  post<T = unknown>(path: string, body?: unknown): Promise<T> {
    return this.request('POST', path, { body })
  }

  put<T = unknown>(path: string, body?: unknown): Promise<T> {
    return this.request('PUT', path, { body })
  }

  delete<T = unknown>(path: string, query?: Query): Promise<T> {
    return this.request('DELETE', path, { query })
  }

  private async request<T>(
    method: string,
    path: string,
    { query, body }: { query?: Query; body?: unknown }
  ): Promise<T> {
    const url = new URL(`${this.apiUrl}/api/v1${path}`)
    for (const [name, value] of Object.entries(query ?? {})) {
      if (value !== undefined) {
        url.searchParams.set(name, String(value))
      }
    }

    let response: Response
    try {
      response = await this.fetchImpl(url, {
        method,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' })
        },
        body: body === undefined ? undefined : JSON.stringify(body)
      })
    } catch (error) {
      throw new ApiError(
        0,
        'UNREACHABLE',
        `The game API at ${this.apiUrl} cannot be reached: ${(error as Error).message}`
      )
    }

    const text = await response.text()
    const parsed = text ? safeJson(text) : undefined

    if (!response.ok) {
      const failure = (parsed ?? {}) as { code?: string; error?: string }
      throw new ApiError(
        response.status,
        failure.code ?? `HTTP_${response.status}`,
        failure.error ?? response.statusText
      )
    }

    return parsed as T
  }
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}
