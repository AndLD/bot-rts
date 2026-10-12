// Data that crosses the sandbox boundary: scripts and the engine exchange only JSON
export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue }
