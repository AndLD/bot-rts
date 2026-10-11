import { Navigate, RouteObject, useRoutes } from 'react-router-dom'
import { useCurrentUser } from '../hooks/auth'
import Blocked from '../pages/Blocked'
import privateRoutes from '../routes/private'
import publicRoutes from '../routes/public'
import { inactiveRoutes } from '../routes/inactive'

const BLOCKED_ROUTES: RouteObject[] = [{ path: '/blocked', element: <Blocked /> }]

export default function AppRoutes() {
  const currentUser = useCurrentUser()

  const { routes, redirect } = getRoutes(currentUser.state)
  const routing = useRoutes(
    routes.length ? [...routes, { path: '*', element: <Navigate replace to={redirect} /> }] : []
  )

  return <>{routing}</>
}

function getRoutes(state: ReturnType<typeof useCurrentUser>['state']): { routes: RouteObject[]; redirect: string } {
  switch (state) {
    case 'loading':
      return { routes: [], redirect: '' }
    case 'active':
      return { routes: privateRoutes, redirect: '/game' }
    case 'unverified':
      return { routes: inactiveRoutes, redirect: '/forbidden' }
    case 'blocked':
      return { routes: BLOCKED_ROUTES, redirect: '/blocked' }
    default:
      return { routes: publicRoutes, redirect: '/auth' }
  }
}
