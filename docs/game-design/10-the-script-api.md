[← Game design index](../GAME-DESIGN.md)

# 10. The script API

Scripts run **inside the bot**, in a sandboxed JavaScript runtime, with a restricted global API. They are how the
player actually plays the game.

## 10.1 Script file contract

A script file is a JavaScript file (`.js`) that **exports a `main` function**. When run from the terminal as
`run <filename> <arg1> … <argN>`, the runtime calls:

```js
async function main(bot, arg1, arg2, /* … */ argN) { /* … */ }
```

- The first argument is the **`bot` object** — the bot's API handle and identity.
- Additional arguments are whatever the player typed after the filename.
- In `shell` mode, lines are evaluated directly with the same `bot` object in scope.

> In the 2024 notes the base id is passed explicitly (`run abc TERMINAL_ID`); in the 2026 notes the first `main`
> argument is the `bot` object. Both are supported: the `bot` object carries identity, and extra args are free-form.

## 10.1.1 Languages and imports ✅

- **Languages:** players may write **JavaScript (`.js`)** and **TypeScript (`.ts`)**. TypeScript is transpiled to
  JavaScript by the engine (transpile only; there is no type-check gate that blocks running a script).
- **Local imports:** scripts may `import` other `.js` / `.ts` / `.json` files that are available to the bot, so players
  can build libraries. Imports are resolved by the engine from the bot's filesystem (§11.4), never from the host
  filesystem; there are no `node_modules`, no `require`, no network imports. The module graph is resolved when the
  execution starts and has limits on depth and total size (tunable config); cyclic imports are rejected.
- **Contract unchanged:** the entry file exports `async function main(bot, ...args)`.
- Code reuse by `execute(file)` still starts a separate execution (§10.2).
- **Transpiler:** a type-stripping transpiler behind a `Transpiler` interface (sucrase preferred, esbuild-wasm as the
  alternative; final choice in Plan 5.8). No type-check; transpile happens in the engine, outside the QuickJS context.
- **Imports stay on the same drive:** relative paths only, no cross-drive imports, so a removed or broken drive can
  only break scripts that live on it.
- **Loading:** the module graph is resolved and loaded when the execution starts; transpiled output is cached by file
  content hash.
- **Editor:** the CodeMirror editor offers TypeScript typings and autocomplete for the `bot` API and the functions its
  modules grant (a `.d.ts` shipped from `lib`).
- **Limits (tunable config):** 32 KB per file, 20 files and import depth 5 per execution.

## 10.2 Available functions

Every function is gated by the module that provides it — **no module, no function**.

✅ **How functions are reached:** each function is a method of the `bot` object passed to `main` (`bot.scan()`), and is
also available as a same-named global bound to the executing bot (`scan()`), so scripts written in the style of the
original notes work unchanged. The examples below use the `bot.` form.

All functions return `Promise<Result<T>>` (§10.3) except `log` and `sleep`, which cannot fail.

| Function | Provided by | Signature | Description |
| --- | --- | --- | --- |
| `scan()` | scanner | `scan(): Promise<Result<MapCell[]>>` | Scan cells in radius. Returns a flat array of map cells, each with its contents and `seenAt` (a snapshot, §4.2); waits for the scanner cooldown; fails with `BUSY` while the scanner is in live mode. |
| `view(since?)` | scanner (continuous mode) | `view(since?: number): Promise<Result<{ cells: MapCell[]; tick: number }>>` | Read the live view; with `since`, only the cells that changed after that tick. Costs 1 op; fails with `NOT_LIVE` if the scanner is not enabled. |
| `move(n)` | engine + chassis | `move(cells: number): Promise<Result>` | Move forward `n` cells; fails with `BLOCKED` if the next cell is occupied. |
| `turn(dir)` | engine + chassis | `turn(direction): Promise<Result>` | Rotate the bot. |
| `aim(x, y)` | weapon | `aim(x, y): Promise<Result>` | Point the weapon at a target. |
| `shoot(x, y)` | weapon | `shoot(x, y): Promise<Result>` | Fire at a target. |
| `dig()` / `mine(x, y)` | drill | `dig(): Promise<Result<{ amount: number }>>` | Extract resources from the target cell. |
| `pick()` / `take(itemId?)` | manipulator | `pick(): Promise<Result<Item>>` | Pick up an item. |
| `drop()` | manipulator | `drop(x?, y?): Promise<Result>` | Drop a carried item. |
| `store(item)` | storage | `store(item): Promise<Result>` | Put an item into storage. |
| `getLocation()` | GPS | `getLocation(): Promise<Result<Location>>` | Current `{ x, y }` (`z` reserved, unused). |
| `repair(bot, moduleId)` | repair | `repair(...): Promise<Result>` | Restore condition of a module on an adjacent bot (§8.4.2). |
| `disassemble(bot, moduleId)` | repair | `disassemble(...): Promise<Result<Scrap>>` | Strip a module into scrap (§8.4.2). |
| `craft(module, count?)`, `assemble(label, moduleIds)`, `research(module)`, `learn(itemId)` | factory | `Promise<Result<…>>` | Factory operations, available to scripts on a bot with a factory module (the base). Same rules as the terminal commands and the Factory GUI. |
| `market.getWallet()`, `market.getOrderBook(resource)`, `market.placeOrder(...)`, `market.cancelOrder(id)`, `market.listAuctions(filter)`, `market.createAuction(...)`, `market.bid(id, amount)`, `market.buyNow(id)`, `market.claimInbox(...)` | marketTerminal | `Promise<Result<…>>` | The remote market (§26); each call costs ops and energy. |
| `connect(botId)` | wireless adapter | `connect(botId): Promise<Result<Connection>>` | Open a link to another bot. |
| `getLinkStatus()` | wireless adapter | `getLinkStatus(): Promise<Result<{ connected: boolean; hops: number; lostSince?: number }>>` | Whether the bot is connected to its base through the radio network, over how many hops, and since when it is not (§11.2.1). |
| `sendMessage(botId, msg)` | wireless adapter | `sendMessage(botId, msg): Promise<Result>` | Send a message to another bot/base. |
| `execute(file)` | processor | `execute(file): Promise<Result<{ executionId: string }>>` | Run a stored script (spawns a parallel execution). |
| `log(...args)` | processor (always on) | `log(...args): void` | Write to the terminal session log. |
| `sleep(ms)` | processor (always on) | `sleep(ms): Promise<void>` | Yield for `ms` of game time. |

Additional functions implied by the module interfaces: `read()`/`write()` (drive), `runCode()` (processor),
`enable()`/`disable()` (battery, generator, scanner), `reload()` (weapon), `disconnect()` (wireless adapter). ✅

## 10.3 Return values & error handling ✅

Every API call returns a **result object**; expected failures are **values**, never exceptions:

```js
{ ok: true, data: … }                                    // success
{ ok: false, code: 'BLOCKED', msg: 'Cell occupied' }     // expected failure
```

- **Error codes** are a closed, typed set in `lib` (initial set): `BLOCKED`, `EMPTY`, `GONE`, `NO_ENERGY`, `NO_MODULE`,
  `BROKEN_MODULE`, `NO_FUNDS`, `NOT_LIVE`, `BUSY`, `NOT_FOUND`, `TOO_LOW`, `EXPIRED`, `INBOX_FULL`, `OUT_OF_RANGE`, `COOLDOWN`, `NO_AMMO`, `NO_SIGNAL`, `NO_SPACE`, `FORBIDDEN`.
- **Only misuse throws**: invalid arguments, calling an API the bot has no module for at the language level, or sandbox
  violations. A throw ends the execution (`killed`, with the error in its log).
- Scripts branch with `if (!r.ok)`; no `try/catch` is needed for routine events such as a blocked cell.
- The set of functions and their module gating are as in §10.2; each function's return type is `Result<T>` (the
  existing callback-style signatures in `lib` module interfaces are migrated).
- Calls may be `await`-ed and are subject to the processor budget (§12.2.1).
