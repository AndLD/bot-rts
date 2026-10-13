import type { ModuleType } from './interfaces/modules'

// The example scripts of the player documentation (design §15.5, §18). They live here, as data, so the documentation shows them and
// the sandbox test suite runs every one of them: an example that no longer works against the script API fails a test.
export interface DocExample {
  id: string
  // What a bot needs to have for the example to work ("no module, no function", design §10.2)
  modules: readonly ModuleType[]
  code: string
}

export const DOC_EXAMPLES: readonly DocExample[] = [
  {
    id: 'hello',
    modules: ['gps'],
    code: `export async function main(bot) {
  bot.log('Hello from', bot.id)

  const where = await bot.getLocation()
  bot.log('I am at', where.ok ? where.data : where.code)
}`
  },
  {
    id: 'scout',
    modules: ['scanner'],
    code: `export async function main(bot) {
  const scan = await bot.scan()

  if (!scan.ok) {
    bot.log('The scan failed:', scan.code)
    return
  }

  const deposits = scan.data.filter((cell) => cell.type === 'resource')
  bot.log('I know', scan.data.length, 'cells,', deposits.length, 'of them deposits')

  for (const cell of deposits) {
    bot.log(cell.resource, 'at', cell.x, cell.y)
  }
}`
  },
  {
    id: 'miner',
    modules: ['engine', 'movement', 'mining'],
    code: `export async function main(bot) {
  while (true) {
    const mined = await bot.dig()

    if (mined.ok) {
      bot.log('mined', mined.data.amount, mined.data.resource)
    } else {
      await bot.move(1)
    }
  }
}`
  },
  {
    id: 'patrol',
    modules: ['engine', 'movement', 'scanner'],
    code: `export async function main(bot) {
  while (true) {
    for (let step = 0; step < 5; step++) {
      const moved = await bot.move(1)

      if (!moved.ok) {
        await bot.turn('right')
        break
      }
    }

    const scan = await bot.scan()
    if (scan.ok) {
      bot.log('I see', scan.data.length, 'cells')
    }

    await bot.sleep(500)
  }
}`
  },
  {
    id: 'guard',
    modules: ['scanner', 'weapon'],
    code: `export async function main(bot) {
  while (true) {
    const scan = await bot.scan()
    const enemy = scan.ok && scan.data.find((cell) => cell.type === 'bot' && cell.contentId !== bot.id)

    if (enemy) {
      await bot.aim(enemy.x, enemy.y)
      const shot = await bot.shoot(enemy.x, enemy.y)
      bot.log(shot.ok ? 'hits: ' + shot.data.hits : shot.code)
    }

    await bot.sleep(200)
  }
}`
  },
  {
    id: 'factory',
    modules: ['factory'],
    code: `export async function main(bot) {
  const order = await bot.craft('scanner-class1', 2)

  bot.log(order.ok ? 'two scanners are on their way' : order.code)
}`
  },
  {
    id: 'notes',
    modules: ['drive'],
    code: `export async function main(bot) {
  // Files are addressed as /<drive>/<path>; the base has a drive called memory-class1
  await bot.write('/memory-class1/notes.txt', 'written at ' + bot.time())

  const notes = await bot.read('/memory-class1/notes.txt')
  bot.log(notes.ok ? notes.data : notes.code)
}`
  }
]
