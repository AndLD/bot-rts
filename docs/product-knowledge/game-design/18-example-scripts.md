[← Game design index](./GAME-DESIGN.md)

# 18. Example scripts

Every `js` block in §17 and §18 is run by a test in the same sandbox as a
player's script, against canned answers of the game API whose cells have the shape of `IMapCell`
([`lib/utils/interfaces/map.ts`](../../../lib/utils/interfaces/map.ts)): `x`, `y`, `type` (`'resource'`, `'bot'`, … or `null`),
`contentId` and, on a resource cell, `resource: { resource, amount }`. A script that uses a function the bot has no module for, a
function that does not exist, or a field a cell does not have, fails the test.

## 18.1 Prospector (from the notes)

See [Scenario C](./17-in-game-scenarios.md#scenario-c--gold-prospector-the-canonical-script).

## 18.2 Miner + hauler loop

```js
export async function main(bot) {
  while (true) {
    const scan = await bot.scan()
    const deposit = scan.ok && scan.data.find((cell) => cell.type === 'resource' && cell.resource && cell.resource.amount > 0)

    if (deposit) {
      const dug = await bot.dig()
      if (dug.ok) bot.log(`mined ${dug.data.amount} ${dug.data.resource}`)
    } else {
      await bot.move(1)
    }

    await bot.sleep(250)
  }
}
```

## 18.3 Guard duty

```js
export async function main(bot) {
  while (true) {
    const scan = await bot.scan()
    const enemy = scan.ok && scan.data.find((cell) => cell.type === 'bot' && cell.contentId !== bot.id)

    if (enemy) {
      await bot.aim(enemy.x, enemy.y)
      await bot.shoot(enemy.x, enemy.y)
    }

    await bot.sleep(200)
  }
}
```

## 18.4 Shell mode snippets

```
/> shell
>>> await bot.scan()
>>> await bot.getLocation()
>>> exit
```
