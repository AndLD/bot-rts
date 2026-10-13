// What the app needs from an authentication provider. Components talk to this interface (through the hooks of this
// feature) and never to a provider's SDK or HTTP endpoints, so a hosted provider can replace the custom one by adding
// another implementation (AGENTS.md §3.3).

// Why an operation failed: the stable API error code when there is one, and the provider's own text
export interface AuthFailure {
  code?: string
  message?: string
}

export type AuthResult = { ok: true } | { ok: false; failure: AuthFailure }

export interface Credentials {
  email: string
  password: string
}

export interface Registration extends Credentials {
  name: string
  acceptedPrivacyVersion: string
}

export interface AuthClient {
  signIn(credentials: Credentials): Promise<AuthResult>
  signUp(registration: Registration): Promise<AuthResult>
  signOut(): Promise<void>
  // A new access token from the current session; null when the session is over
  refresh(): Promise<string | null>

  verifyEmail(token: string): Promise<AuthResult>
  resendVerification(email: string): Promise<AuthResult>
  requestPasswordReset(email: string): Promise<AuthResult>
  resetPassword(token: string, password: string): Promise<AuthResult>
  changePassword(currentPassword: string, newPassword: string): Promise<AuthResult>
  requestEmailChange(password: string, newEmail: string): Promise<AuthResult>
  confirmEmailChange(token: string): Promise<AuthResult>
  requestAccountDeletion(password: string): Promise<AuthResult>
  confirmAccountDeletion(token: string): Promise<AuthResult>
}
