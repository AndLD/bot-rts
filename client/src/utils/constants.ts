export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080'

export enum Entity {
  USERS = 'users',
  MAP = 'map', // General game map points + user map points
  BOTS = 'bots',
  FILES = 'files'
}
