export const RNG = Symbol('Rng')

// The only source of randomness for game logic (AGENTS.md §9); implementations may be seeded
export interface Rng {
  // A float in [0, 1)
  next(): number
}
