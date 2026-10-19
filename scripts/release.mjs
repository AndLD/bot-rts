// Prepares a release on its branch (docs/operations/RELEASING.md): sets the version in every package.json and in the lock file, and moves the
// entries of docs/product-knowledge/CHANGELOG.md under "Unreleased" to a section of the version. It commits and tags nothing.
// Usage (on branch release/<x.y.z> or hotfix/<x.y.z>):  node scripts/release.mjs [--dry-run]
import { spawnSync } from 'node:child_process'
import { readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { nextVersion, parseFragment, releaseChangelog } from './release-lib.mjs'

const root = resolve(import.meta.dirname, '..')
const isDryRun = process.argv.includes('--dry-run')
const REPO_URL = 'https://github.com/AndLD/bot-rts'
const FRAGMENTS = resolve(root, 'docs/product-knowledge/changelog.d')
const PACKAGES = ['package.json', 'lib/package.json', 'api/package.json', 'client/package.json']

function git(...args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' })
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${result.stderr}`)
  }
  return result.stdout.trim()
}

try {
  const branch = git('rev-parse', '--abbrev-ref', 'HEAD')
  const match = /^(release|hotfix)\/(\d+\.\d+\.\d+)$/.exec(branch)
  if (!match) {
    throw new Error(`Run this on a branch named release/<x.y.z> or hotfix/<x.y.z>, not on "${branch}"`)
  }
  if (!isDryRun && git('status', '--porcelain')) {
    throw new Error('The working tree is not clean: commit or stash first')
  }

  const rootManifest = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
  const version = nextVersion(rootManifest.version, match[2])
  const date = new Date().toISOString().slice(0, 10)
  const fragmentFiles = readdirSync(FRAGMENTS)
    .filter((name) => name.endsWith('.md') && name !== 'README.md')
    .sort()
  const fragments = fragmentFiles.map((name) => parseFragment(name, readFileSync(resolve(FRAGMENTS, name), 'utf8')))
  const changelog = releaseChangelog(
    readFileSync(resolve(root, 'docs/product-knowledge/CHANGELOG.md'), 'utf8'),
    version,
    date,
    REPO_URL,
    fragments
  )

  console.log(`${branch}: ${rootManifest.version} -> ${version} (${date}), ${fragments.length} changelog fragments`)
  if (isDryRun) {
    console.log('Dry run: nothing was written.')
  } else {
    for (const file of PACKAGES) {
      const path = resolve(root, file)
      const manifest = JSON.parse(readFileSync(path, 'utf8'))
      writeFileSync(path, `${JSON.stringify({ ...manifest, version }, null, 2)}\n`)
    }
    writeFileSync(resolve(root, 'docs/product-knowledge/CHANGELOG.md'), changelog)
    for (const name of fragmentFiles) {
      rmSync(resolve(FRAGMENTS, name))
    }
    const lock = spawnSync('npm', ['install', '--package-lock-only', '--ignore-scripts'], {
      cwd: root,
      stdio: 'inherit'
    })
    if (lock.status !== 0) {
      throw new Error('npm install --package-lock-only failed')
    }
    console.log(
      `Done. Review the diff, then: git commit -am "chore(release): ${version}" and open the pull request into main.`
    )
  }
} catch (error) {
  console.error(error.message)
  process.exit(1)
}
