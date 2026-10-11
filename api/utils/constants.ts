export const startTimestamp = Date.now()

export const environment = process.env.NODE_ENV || 'development'
export const isProduction = environment === 'production'

export const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173'

export const rateLimit = {
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  maxAuthRequests: Number(process.env.RATE_LIMIT_AUTH_MAX) || 20
}
