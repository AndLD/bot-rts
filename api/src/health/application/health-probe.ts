export const HEALTH_PROBE = Symbol('HealthProbe')

export interface HealthProbe {
  // Resolves when the database answers
  pingDatabase(): Promise<void>
}
