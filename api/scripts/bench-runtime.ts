// Benchmark spike for plan task 5.1: QuickJS context memory and active bots per tick (docs/development-plan/phase-5-script-runtime.md).
// Run with `npx ts-node scripts/bench-runtime.ts [bots]` from the api folder.
import { newQuickJSWASMModule } from 'quickjs-emscripten'

const BOTS = Number(process.argv[2] ?? 1000)
const TICKS = 50
const SLICE_MS = 5

const SCRIPT = `
  let n = 0
  globalThis.step = () => { for (let i = 0; i < 2000; i++) n += i % 7; return n }
`

// Live vision: a chunk index of live areas, one lookup per changed cell (design §4.4)
const benchLiveAreas = (areas: number, changedCellsPerTick: number) => {
  const CHUNK = 16
  const index = new Map<string, number[]>()
  for (let a = 0; a < areas; a++) {
    const cx = (a * 37) % 200
    const cy = (a * 91) % 200
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const key = `${cx + dx}:${cy + dy}`
        index.set(key, [...(index.get(key) ?? []), a])
      }
    }
  }
  const start = performance.now()
  let delivered = 0
  for (let c = 0; c < changedCellsPerTick; c++) {
    const watchers = index.get(`${Math.floor(((c * 53) % 3200) / CHUNK)}:${Math.floor(((c * 29) % 3200) / CHUNK)}`)
    delivered += watchers?.length ?? 0
  }
  const ms = performance.now() - start
  console.log(
    `${areas} live areas, ${changedCellsPerTick} changed cells: ${ms.toFixed(2)} ms per tick (${delivered} deliveries)`
  )
}

const main = async () => {
  benchLiveAreas(1000, 2000)
  benchLiveAreas(10000, 5000)
  const quickjs = await newQuickJSWASMModule()
  const before = process.memoryUsage().rss
  const contexts = []
  const t0 = performance.now()
  for (let i = 0; i < BOTS; i++) {
    const runtime = quickjs.newRuntime()
    runtime.setMemoryLimit(8 * 1024 * 1024)
    runtime.setMaxStackSize(256 * 1024)
    const ctx = runtime.newContext()
    ctx.unwrapResult(ctx.evalCode(SCRIPT)).dispose()
    contexts.push({ runtime, ctx })
  }
  const createMs = performance.now() - t0
  const rssPerBot = (process.memoryUsage().rss - before) / BOTS
  console.log(
    `${BOTS} contexts created in ${createMs.toFixed(0)} ms, ~${(rssPerBot / 1024).toFixed(0)} KiB RSS per context`
  )

  const tickTimes: number[] = []
  for (let t = 0; t < TICKS; t++) {
    const start = performance.now()
    for (const { runtime, ctx } of contexts) {
      const deadline = performance.now() + SLICE_MS
      runtime.setInterruptHandler(() => performance.now() > deadline)
      ctx.unwrapResult(ctx.evalCode('step()')).dispose()
    }
    tickTimes.push(performance.now() - start)
  }
  tickTimes.sort((a, b) => a - b)
  const p = (q: number) => tickTimes[Math.min(tickTimes.length - 1, Math.floor(q * tickTimes.length))].toFixed(1)
  console.log(`tick over ${BOTS} active bots: p50 ${p(0.5)} ms, p95 ${p(0.95)} ms, max ${p(1)} ms (budget 80 ms)`)
  for (const { runtime, ctx } of contexts) {
    ctx.dispose()
    runtime.dispose()
  }
}

main()
