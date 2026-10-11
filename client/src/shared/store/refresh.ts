let inflight: Promise<string | null> | null = null

// The refresh token rotates, so two simultaneous refreshes would make the second one fail and end the session. Every
// caller therefore shares the refresh that is already running.
export function refreshOnce(run: () => Promise<string | null>): Promise<string | null> {
  inflight ??= run().finally(() => {
    inflight = null
  })

  return inflight
}
