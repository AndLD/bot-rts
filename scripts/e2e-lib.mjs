// The pure part of scripts/e2e.mjs: which of the ports a run needs are already taken.
// `listening(port)` returns the ids of the processes that listen on the port.
export function portsInUse(ports, listening) {
  return ports.filter((port) => listening(port).length > 0)
}
