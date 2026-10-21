// The pure part of scripts/e2e.mjs: which of the ports a run needs are already taken.
// `listening(port)` returns the ids of the processes that listen on the port.
export function portsInUse(ports, listening) {
  return ports.filter((port) => listening(port).length > 0)
}

// "2/4" is the second of four shards; anything else is an error, so that a typo does not run every spec in every job
export function parseShard(text) {
  const match = /^(\d+)\/(\d+)$/.exec(text ?? '')
  const index = Number(match?.[1])
  const count = Number(match?.[2])

  if (!match || index < 1 || index > count) {
    throw new Error(`Bad --shard "${text}": use <index>/<count>, for example 2/4`)
  }

  return { index, count }
}

// The specs of one shard: longest first into the shard with the least time so far, by the recorded duration of each spec in seconds
// (a spec that is not recorded yet counts as the median of the recorded ones, so a new spec still lands somewhere sensible).
// The result depends only on the arguments, so every job of a run computes the same split.
export function specsOfShard(specs, durations, { index, count }) {
  const recorded = specs.map((spec) => durations[spec]).filter((seconds) => seconds !== undefined)
  const sorted = [...recorded].sort((a, b) => a - b)
  const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 1
  const weight = (spec) => durations[spec] ?? median
  const shards = Array.from({ length: count }, () => ({ total: 0, specs: [] }))

  for (const spec of [...specs].sort((a, b) => weight(b) - weight(a) || a.localeCompare(b))) {
    const lightest = shards.reduce((best, shard) => (shard.total < best.total ? shard : best))
    lightest.total += weight(spec)
    lightest.specs.push(spec)
  }

  return shards[index - 1].specs.sort()
}
