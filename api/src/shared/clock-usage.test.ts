import { readdirSync, readFileSync, statSync } from 'fs'
import { join, relative } from 'path'

// The files that read the real clock (`CLOCK`), with the reason. Everything that is a rule of the game reads `GAME_CLOCK` instead, so a
// change of the game's time never moves a login, a ban or the audit trail. The table of the reasons is docs/testing/clock-consumers.md.
const REAL_CLOCK = [
  'app.factory.ts',
  'achievements/achievements.module.ts',
  'admin/admin.module.ts',
  'analytics/analytics.module.ts',
  'apikeys/apikeys.module.ts',
  'apikeys/presentation/api-access.guard.ts',
  'auth/auth.module.ts',
  'balance/balance.module.ts',
  'devtools/devtools.module.ts',
  'engine/engine-worker.module.ts',
  'featureswitches/featureswitches.module.ts',
  'lifecycle/lifecycle.module.ts',
  'logs/logs.module.ts',
  'monitoring/monitoring.module.ts',
  'operations/operations.module.ts',
  'player-notifications/player-notifications.module.ts',
  'persistence/persistence.module.ts',
  'players/players.module.ts',
  'players/presentation/players.controller.ts',
  'ratelimit/ratelimit.module.ts',
  'retention/retention.module.ts',
  'security/security.module.ts',
  'settings/settings.module.ts',
  'shared/application/clock.ts',
  'shared/application/game-clock.ts',
  'shared/shared.module.ts',
  'spawn/spawn.module.ts',
  'supervision/supervision.module.ts',
  'terminal/terminal-core.module.ts',
  'terminal/terminal.module.ts',
  'time/game-time-core.module.ts',
  'tutorial/tutorial.module.ts',
  'users/users.module.ts',
  'viewas/viewas.module.ts'
]

// The modules whose rules must run on the game clock: a file there that reads the real one is a bug
const GAME_RULE_FOLDERS = ['crafting', 'bots', 'map', 'mapview', 'modules', 'time/application', 'time/presentation']

const SRC = join(__dirname, '..')

function sourceFiles(folder: string): string[] {
  return readdirSync(folder).flatMap((name) => {
    const path = join(folder, name)

    if (statSync(path).isDirectory()) {
      return sourceFiles(path)
    }

    return path.endsWith('.ts') && !path.endsWith('.test.ts') ? [path] : []
  })
}

const readers = sourceFiles(SRC)
  .filter((path) => /\bCLOCK\b/.test(readFileSync(path, 'utf8')))
  .map((path) => relative(SRC, path))
  .sort()

describe('which clock the code reads', () => {
  it('lets only the listed files read the real clock', () => {
    expect(readers.filter((path) => !REAL_CLOCK.includes(path))).toEqual([])
  })

  it('has no listed file that no longer reads it, so the list stays true', () => {
    expect(REAL_CLOCK.filter((path) => !readers.includes(path))).toEqual([])
  })

  it('keeps the rules of the game off the real clock', () => {
    expect(readers.filter((path) => GAME_RULE_FOLDERS.some((folder) => path.startsWith(`${folder}/`)))).toEqual([])
  })

  it('is described in docs/testing/clock-consumers.md, every listed file with its reason', () => {
    const doc = readFileSync(join(SRC, '..', '..', 'docs', 'testing', 'clock-consumers.md'), 'utf8')

    expect(REAL_CLOCK.filter((path) => !doc.includes(path))).toEqual([])
  })
})
