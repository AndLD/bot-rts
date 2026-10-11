export const CREDENTIAL_AUTH = Symbol('CredentialAuthService')

export interface RegisterInput {
  name: string
  email: string
  password: string
  userAgent?: string
}

export interface LoginInput {
  email: string
  password: string
  userAgent?: string
}

// An access token for the Authorization header and the opaque refresh token for the HTTP-only cookie
export interface SessionTokens {
  accessToken: string
  refreshToken: string
}

// The account operations of providers whose credentials we manage (the custom provider). A hosted provider does these
// steps in the browser and does not implement this port, so the endpoints are not mounted for it.
export interface CredentialAuthService {
  register(input: RegisterInput): Promise<SessionTokens>
  login(input: LoginInput): Promise<SessionTokens>
  refresh(refreshToken: string): Promise<SessionTokens>
  logout(refreshToken: string): Promise<void>
  verifyEmail(token: string): Promise<void>
  resendVerification(email: string): Promise<void>
  requestPasswordReset(email: string): Promise<void>
  resetPassword(token: string, newPassword: string): Promise<void>
  changePassword(
    userId: string,
    sessionId: string | undefined,
    currentPassword: string,
    newPassword: string
  ): Promise<void>
  requestEmailChange(userId: string, password: string, newEmail: string): Promise<void>
  confirmEmailChange(token: string): Promise<void>
  requestAccountDeletion(userId: string, password: string): Promise<void>
  confirmAccountDeletion(token: string): Promise<void>
}
