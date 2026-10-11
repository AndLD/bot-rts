// A syntactically valid access token expiring `secondsFromNow` from now
export function makeJwt(secondsFromNow: number): string {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url')

  return `${encode({ alg: 'HS256' })}.${encode({ exp: Math.floor(Date.now() / 1000) + secondsFromNow })}.signature`
}
