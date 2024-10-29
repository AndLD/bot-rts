import { RouteObject } from 'react-router-dom'
// import Dashboard from '../pages/Dashboard'
// import AdminLayout from '../components/AdminLayout/AdminLayout'
// import Settings from '../pages/Settings'
// import Users from '../pages/Users'
import Game from '../pages/Game'

const privateRoutes: RouteObject[] = [
  // {
  //     path: '/admin',
  //     element: <AdminLayout />,
  //     children: [
  //         {
  //             path: '/admin',
  //             element: <Dashboard />
  //         },
  //         {
  //             path: '/admin/users',
  //             element: <Users />
  //         }
  //     ]
  // },
  {
    path: '/game',
    element: <Game />
  }
]

export default privateRoutes
