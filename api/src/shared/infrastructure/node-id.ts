import { hostname } from 'os'

// What tells one process from another in the logs of several nodes: the host and the process id. The API thread and the engine
// thread of one process share it and differ in the service name.
export const nodeId = (): string => `${hostname()}:${process.pid}`
