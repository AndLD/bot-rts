import { RouteObject } from 'react-router-dom'
import AuthPage from '../features/auth/AuthPage'
import BlockedPage from '../features/auth/BlockedPage'
import ForbiddenPage from '../features/auth/ForbiddenPage'
import VerificationPage from '../features/auth/VerificationPage'
import GamePage from '../features/game/GamePage'

// Which pages a visitor can open depends on who they are; `redirect` is where every other address leads
export interface RouteSet {
  routes: RouteObject[]
  redirect: string
}

export const anonymousRoutes: RouteSet = {
  routes: [
    { path: '/auth', element: <AuthPage /> },
    { path: '/verification', element: <VerificationPage /> }
  ],
  redirect: '/auth'
}

// Signed in, but the email is not confirmed yet
export const unverifiedRoutes: RouteSet = {
  routes: [
    { path: '/forbidden', element: <ForbiddenPage /> },
    { path: '/verification', element: <VerificationPage /> }
  ],
  redirect: '/forbidden'
}

export const blockedRoutes: RouteSet = {
  routes: [{ path: '/blocked', element: <BlockedPage /> }],
  redirect: '/blocked'
}

export const playerRoutes: RouteSet = {
  routes: [{ path: '/game', element: <GamePage /> }],
  redirect: '/game'
}
