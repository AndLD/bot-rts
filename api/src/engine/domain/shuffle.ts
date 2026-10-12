import { Rng } from '../../shared/application/rng'

// A Fisher-Yates shuffle with the given generator: the same seed gives the same order (design §12.4)
export function shuffled<T>(items: readonly T[], rng: Rng): T[] {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}
