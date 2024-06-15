import Forbidden from '../pages/Forbidden'
import Verification from '../pages/Verification'

export const inactiveRoutes = [
    {
        path: '/forbidden',
        element: <Forbidden />
    },
    { path: '/verification', element: <Verification /> }
]
