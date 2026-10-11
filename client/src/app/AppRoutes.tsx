import { Navigate, useRoutes } from 'react-router-dom'
import { CurrentUser, useCurrentUser } from '../features/auth/hooks'
import { anonymousRoutes, blockedRoutes, playerRoutes, RouteSet, unverifiedRoutes } from './routes'

function getRouteSet(state: CurrentUser['state']): RouteSet | null {
  switch (state) {
    case 'loading':
      return null
    case 'active':
      return playerRoutes
    case 'unverified':
      return unverifiedRoutes
    case 'blocked':
      return blockedRoutes
    default:
      return anonymousRoutes
  }
}

export default function AppRoutes() {
  const { state } = useCurrentUser()
  const routeSet = getRouteSet(state)
  const routing = useRoutes(
    routeSet ? [...routeSet.routes, { path: '*', element: <Navigate replace to={routeSet.redirect} /> }] : []
  )

  return <>{routing}</>
}
