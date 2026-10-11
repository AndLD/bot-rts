const MULTIPLIERS = {
  ms: 1,
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000
}

// "30d" -> milliseconds; 0 when the string has no recognizable duration
export function convertTimeStringToMilliseconds(timeString: string): number {
  const match = timeString.match(/^(\d+)(ms|s|m|h|d)$/)

  return match ? parseInt(match[1]) * MULTIPLIERS[match[2] as keyof typeof MULTIPLIERS] : 0
}
