// Runtime hook (PreToolUse on file writes): refuses the edit of an environment file (values go to `.env.example` only), and, in pinned mode, of a file
// of the vendored framework (the framework changes at its source, then a sync).
import { basename, relative, resolve } from 'node:path'
import { readLock, MODES, VENDOR_DIR } from '../lib/lock.mjs'
import { runHook } from './io.mjs'
import { isMain } from '../lib/main-module.mjs'

const ENV_FILE = /^\.env(\..+)?$/

/** The message that refuses the edit of `path`, or null. `vendored` is true when the framework copy is pinned (not detached) and `path` is inside it. */
export function refusal(path, { root, pinned }) {
  const name = basename(path)
  if (ENV_FILE.test(name) && name !== '.env.example') {
    return `${name} holds local values and secrets: never edit it. Add the variable to .env.example and tell the owner (the non-negotiables of the entry file).`
  }
  const inside = relative(resolve(root), resolve(root, path))
  if (pinned && (inside === VENDOR_DIR || inside.startsWith(`${VENDOR_DIR}/`))) {
    return `${inside} is the vendored framework: never edit it. Change the framework source and run \`harness sync\` (the entry file, vendored framework rule).`
  }
  return null
}

export function decide(event) {
  if (event.kind !== 'edit-before') {
    return {}
  }
  const lock = readLock(event.cwd)
  const message = refusal(event.path, { root: event.cwd, pinned: lock?.mode === MODES.pinned })
  return message ? { block: message } : {}
}

if (isMain(import.meta.url)) {
  await runHook((event) => decide(event), { kind: 'edit-before' })
}
