import { SetMetadata } from '@nestjs/common'

export const ROLE_KEY = 'requiredRole'

export type RequiredRole = 'admin' | 'owner'

// `admin` lets admins and owners in; `owner` lets owners only. The role is read from our store, never from the token.
export const RequireRole = (role: RequiredRole) => SetMetadata(ROLE_KEY, role)
