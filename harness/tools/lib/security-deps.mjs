// The dependency and supply-chain checks of `harness check security`: a lock file beside each manifest (S2-001), versions that are not open (S2-003), no opaque
// executable among the tracked files (S2-016), and the audit against an advisory database (S2-010, which needs the network and so runs only when asked).
// What lists the dependencies is the stack's (role "dependency-audit"); the checks themselves are the same for every stack.
import { spawnSync } from 'node:child_process'
import { closeSync, openSync, readSync } from 'node:fs'
import { basename, dirname, join, posix } from 'node:path'
import { matchesAny, readText } from './security-secrets.mjs'
import { owns, selectedStacks, stackModule } from './stacks.mjs'

// Files that are binary on purpose; an executable or an archive of code is never in this list
const MEDIA = /\.(?:png|jpe?g|gif|ico|webp|avif|bmp|svg|woff2?|ttf|otf|eot|pdf|mp3|mp4|webm|mov|wav|ogg)$/i
const CODE_FILE = /\.(?:exe|dll|so|dylib|a|o|class|jar|war|pyc|pyo|wasm|node|bin|dmg|msi|apk|zip|tar|tgz|gz|7z|rar)$/i
const MAGIC = [
  [Buffer.from([0x7f, 0x45, 0x4c, 0x46]), 'ELF executable'],
  [Buffer.from([0xcf, 0xfa, 0xed, 0xfe]), 'Mach-O executable'],
  [Buffer.from([0xfe, 0xed, 0xfa, 0xce]), 'Mach-O executable'],
  [Buffer.from([0xca, 0xfe, 0xba, 0xbe]), 'Mach-O or Java class file'],
  [Buffer.from('MZ'), 'Windows executable']
]

/** The specs of the dependency files of the selected stacks: `{ stack, spec }`, for the stacks that fill the role. */
export function dependencySpecs(profile) {
  return selectedStacks(profile).flatMap((stack) => {
    const module = stackModule(stack, 'dependency-audit')
    return module ? [{ stack, stackCount: selectedStacks(profile).length, spec: module.dependencyAudit(profile) }] : []
  })
}

/** S2-001 and S2-003 over the tracked files. Returns the problems and the number of manifests read. */
export function checkManifests({ root, profile, files }) {
  const tracked = new Set(files)
  const problems = []
  let manifests = 0
  for (const { stack, stackCount, spec } of dependencySpecs(profile)) {
    for (const entry of spec.manifests) {
      const found = files.filter(
        (file) =>
          !file.split('/').includes('node_modules') &&
          matchesAny(basename(file), [entry.glob]) &&
          owns(stack, file, stackCount)
      )
      for (const file of found) {
        manifests += 1
        if (entry.locks.length && !entry.locks.some((lock) => tracked.has(posix.join(dirname(file), lock)))) {
          problems.push({
            probe: 'S2-001',
            text: `${file}: no lock file is tracked beside it (${entry.locks.join(', ')}), so a fresh install resolves new versions`
          })
        }
        const text = readText(root, file)
        for (const reason of text === null ? [] : spec.versionProblems(file, text)) {
          problems.push({ probe: 'S2-003', text: `${file}: ${reason}` })
        }
      }
    }
  }
  return { problems, manifests }
}

function headOf(path) {
  const descriptor = openSync(path, 'r')
  try {
    const buffer = Buffer.alloc(8000)
    return buffer.subarray(0, readSync(descriptor, buffer, 0, 8000, 0))
  } finally {
    closeSync(descriptor)
  }
}

/** S2-016: tracked files that are executables or archives of code, or binary files that are not media; `security.exclude` names the ones that belong. */
export function checkBinaries({ root, files }) {
  const problems = []
  for (const file of files) {
    let kind = CODE_FILE.test(file) ? 'a compiled or archived file' : null
    if (!kind && !MEDIA.test(file)) {
      let head
      try {
        head = headOf(join(root, file))
      } catch {
        continue
      }
      kind =
        MAGIC.find(([magic]) => head.subarray(0, magic.length).equals(magic))?.[1] ??
        (head.includes(0) ? 'a binary file' : null)
    }
    if (kind)
      problems.push({
        probe: 'S2-016',
        text: `${file}: ${kind} is tracked; nobody can read what it does, so build it in CI, or list it in security.exclude with its origin`
      })
  }
  return problems
}

/** S2-010: runs each audit command of the stacks (the network is needed); a non-zero exit is the problem. */
export function runAudit({
  root,
  profile,
  run = (command) => spawnSync(command, { cwd: root, shell: true, encoding: 'utf8' })
}) {
  const problems = []
  const commands = []
  for (const { spec } of dependencySpecs(profile)) {
    const command = profile.commands?.audit ?? spec.command
    if (commands.includes(command)) continue
    commands.push(command)
    const result = run(command)
    if (result.status !== 0) {
      const tail = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim().split('\n').slice(-3).join(' | ')
      problems.push({ probe: 'S2-010', text: `\`${command}\` exited with ${result.status}: ${tail.slice(0, 300)}` })
    }
  }
  return { problems, commands }
}
