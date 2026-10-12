// How the map shows the age of what it remembers (design §4.3)

export interface AgingOptions {
  // Age (in ticks) up to which a snapshot is still drawn at full strength
  fullTicks: number
  // The ticks over which it fades from full to the minimum
  fadeTicks: number
  minAlpha: number
}

export const DEFAULT_AGING: AgingOptions = { fullTicks: 20, fadeTicks: 600, minAlpha: 0.35 }

export function ageAlpha(age: number, options: AgingOptions = DEFAULT_AGING) {
  if (age <= options.fullTicks) {
    return 1
  }

  const progress = Math.min(1, (age - options.fullTicks) / options.fadeTicks)

  return 1 - progress * (1 - options.minAlpha)
}

// "seen N s ago": the age in whole seconds, from ticks and the tick length
export const ageSeconds = (now: number, seenAt: number, tickIntervalMs: number) =>
  Math.max(0, Math.round(((now - seenAt) * tickIntervalMs) / 1000))
