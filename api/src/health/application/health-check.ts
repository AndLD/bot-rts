export const HEALTH_CHECKS = Symbol('HealthChecks')

export type Component = 'database' | 'redis' | 'engine'

// One thing the API needs to do its work; `check` resolves when it answers and rejects when it does not
export interface HealthCheck {
  readonly component: Component
  check(): Promise<void>
}
