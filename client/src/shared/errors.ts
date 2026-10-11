import { SerializedError } from '@reduxjs/toolkit'
import { FetchBaseQueryError } from '@reduxjs/toolkit/query'

// The message the API returned in its error body, or a generic one
export function getErrorMessage(error: FetchBaseQueryError | SerializedError | undefined): string {
  const body = (error as FetchBaseQueryError | undefined)?.data as { error?: string } | undefined

  return body?.error ?? 'Something went wrong'
}
