// Whether a script was started as the program (`node script.mjs`), and not imported. Node gives the path the user typed in `process.argv[1]`, a link
// included, and the real path in `import.meta`, so the two are compared by their real paths: a project under a linked folder, or a hook started
// through a link, would otherwise do nothing at all, and with exit code 0.
import { realpathSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

/**
 * @param {string} moduleUrl the `import.meta.url` of the script
 * @param {string | undefined} started the path the process was started with (`process.argv[1]`)
 */
export function isMain(moduleUrl, started = process.argv[1]) {
  if (!started) {
    return false
  }
  try {
    return realpathSync(started) === realpathSync(fileURLToPath(moduleUrl))
  } catch {
    return false
  }
}
