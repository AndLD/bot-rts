export interface IAuthPostBody {
  email: string
  password: string
}

// Returned by register, login and refresh; the refresh token travels in an HTTP-only cookie
export interface IAuthTokenResponse {
  accessToken: string
}
