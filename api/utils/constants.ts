export const startTimestamp = Date.now()

export const environment = process.env.NODE_ENV || 'development'
export const isProduction = environment === 'production'

export const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173'

export enum Entity {
    USERS = 'users',
    MAP = 'map', // General game map points + user map points
    BOTS = 'bots',
    FILES = 'files'
}
