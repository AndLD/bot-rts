// The query string of the filters of the audit trail, as the list and the export both take them: what is not set is left out
export function queryOf(filters: Record<string, string | undefined>): string {
  const params = new URLSearchParams()

  for (const [key, value] of Object.entries(filters)) {
    if (value) {
      params.set(key, value)
    }
  }

  return params.toString()
}
