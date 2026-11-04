// Versions of the framework as the migration reads them: `x.y.z` and `x.y.z-dev.n` (a development version, tagged before the final one).

const PATTERN = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/

/** `{ numbers: [x, y, z], pre }` of a version; throws on a text that is none. */
export function parseVersion(version) {
  const match = PATTERN.exec(version)
  if (!match) {
    throw new Error(`"${version}" is not a version (x.y.z, or x.y.z-dev.n)`)
  }
  return { numbers: match.slice(1, 4).map(Number), pre: match[4] ?? null }
}

const compareIdentifiers = (a, b) => {
  const numeric = /^\d+$/
  if (numeric.test(a) && numeric.test(b)) return Number(a) - Number(b)
  if (numeric.test(a)) return -1
  if (numeric.test(b)) return 1
  return a < b ? -1 : a > b ? 1 : 0
}

/** Negative when `a` comes before `b`; a development version comes before its final version. */
export function compareVersions(a, b) {
  const left = parseVersion(a)
  const right = parseVersion(b)
  for (let index = 0; index < 3; index += 1) {
    if (left.numbers[index] !== right.numbers[index]) return left.numbers[index] - right.numbers[index]
  }
  if (left.pre === right.pre) return 0
  if (left.pre === null) return 1
  if (right.pre === null) return -1
  const leftParts = left.pre.split('.')
  const rightParts = right.pre.split('.')
  for (let index = 0; index < Math.max(leftParts.length, rightParts.length); index += 1) {
    if (leftParts[index] === undefined) return -1
    if (rightParts[index] === undefined) return 1
    const order = compareIdentifiers(leftParts[index], rightParts[index])
    if (order !== 0) return order
  }
  return 0
}

/** The version a lock without the migrations record counts as. */
export const FIRST_VERSION = '0.1.0'

/** The final version a development version leads to (`0.2.0-dev.1` gives `0.2.0`). */
export const baseVersion = (version) => parseVersion(version).numbers.join('.')

export const isDevelopment = (version) => parseVersion(version).pre !== null
