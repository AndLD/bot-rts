import { EnginePort } from '../application/engine-port'
import { WorldActionName, WorldActions } from '../application/world-actions'

// The use case as a function that asks the engine to run it and waits for its answer
export function throughEngine<K extends WorldActionName>(port: Pick<EnginePort, 'act'>, name: K): WorldActions[K] {
  return ((...args: Parameters<WorldActions[K]>) => port.act(name, args)) as WorldActions[K]
}

// A service whose listed methods are run by the engine; every other method (the reads) runs here. When the engine is
// switched off the service itself is returned, so a deployment or a test without an engine keeps working.
export function routedThroughEngine<T extends object>(
  service: T,
  port: Pick<EnginePort, 'act'>,
  isEnabled: boolean,
  methods: { [K in keyof T]?: WorldActionName }
): T {
  if (!isEnabled) {
    return service
  }
  const routed = Object.create(service) as Record<string, unknown>
  for (const [method, action] of Object.entries(methods)) {
    routed[method] = throughEngine(port, action as WorldActionName)
  }
  return routed as T
}
