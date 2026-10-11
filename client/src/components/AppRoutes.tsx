import { Navigate, RouteObject, useRoutes } from 'react-router-dom'
import { useEffect, useState } from 'react'
import privateRoutes from '../routes/private'
import publicRoutes from '../routes/public'
// import Forbidden from '../pages/Forbidden'
import { IUserState } from '@lib/utils/interfaces/users.ts'
import { parseUser } from '../utils/jwt'
import { useToken } from '../hooks/auth'
// import { layoutContext } from '../context'
// import useLayoutContext from '../hooks/pages/layout'
import { inactiveRoutes } from '../routes/inactive.tsx'

export default function AppRoutes() {
  const token = useToken()

  const [routes, setRoutes] = useState<RouteObject[]>([])
  const [redirectRoute, setRedirectRoute] = useState<string | null>(null)

  useEffect(() => {
    const user: IUserState | null = parseUser(token)

    if (user && !user.active) {
      setRoutes(inactiveRoutes)
      setRedirectRoute('/forbidden')
      return
    }

    if (user) {
      if (user.status === 'owner' || user.status === 'admin') {
        setRoutes(privateRoutes)
        setRedirectRoute('/game')
      } else if (user.status === 'user' || user.status === 'unlimited') {
        setRoutes(privateRoutes)

        setRedirectRoute('/game')
      } else {
        // setRoutes([{ path: '/forbidden', element: <Forbidden /> }])
        // setRedirectRoute('/forbidden')
      }
    } else {
      setRoutes(publicRoutes)
      setRedirectRoute('/auth')
    }
  }, [token])

  const routing = useRoutes(
    redirectRoute
      ? [
          ...routes,
          {
            path: '*',
            element: <Navigate replace to={redirectRoute} />
          }
        ]
      : routes
  )

  return (
    // <clustersContext.Provider value={useClustersContextValue()}>
    //     <layoutContext.Provider value={useLayoutContext()}>{routing}</layoutContext.Provider>
    // </clustersContext.Provider>
    <>{routing}</>
  )
}
