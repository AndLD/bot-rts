// The values the client reads from NEXT_PUBLIC_* at import time
process.env.NEXT_PUBLIC_API_URL = 'http://api.test'

// jsdom has no fetch; tests that reach the network must stub it themselves
globalThis.fetch = (() => Promise.reject(new Error('fetch is not stubbed in this test'))) as typeof fetch
