import { createContext, useContext } from 'react'
import type { IAdminMe } from '@lib/utils/admin'

export const AdminMeContext = createContext<IAdminMe | null>(null)

// Who the admin is; only available inside the console shell, after the second factor
export function useAdminMe(): IAdminMe {
  const me = useContext(AdminMeContext)

  if (!me) {
    throw new Error('useAdminMe must be used inside the admin shell')
  }

  return me
}
