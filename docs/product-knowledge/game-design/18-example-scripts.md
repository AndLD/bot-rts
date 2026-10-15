[← Game design index](./GAME-DESIGN.md)

# 18. Example scripts

## 18.1 Prospector (from the notes)

See [Scenario C](./17-in-game-scenarios.md#scenario-c--gold-prospector-the-canonical-script).

## 18.2 Miner + hauler loop

```js
async function main(bot) {
  while (true) {
    const scan = await bot.scan()
    const deposit = scan.ok && scan.data.find((c) => c.type.startsWith('RESOURCE.') && c.amount > 0)

    if (deposit) {
      const dug = await bot.dig()
      if (dug.ok) bot.log(`mined ${dug.data.amount} ${deposit.type}`)
    } else {
      await bot.move(1)
    }

    await bot.sleep(250)
  }
}
```

## 18.3 Guard duty

```js
async function main(bot) {
  while (true) {
    const scan = await bot.scan()
    const enemy = scan.ok && scan.data.find((c) => c.type === 'BOT' && c.baseId !== bot.baseId)

    if (enemy) {
      await bot.aim(enemy.location.x, enemy.location.y)
      await bot.shoot(enemy.location.x, enemy.location.y)
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
>>> await bot.sendMessage('<baseId>', 'pong')
>>> exit
```
