// Draws the sprite atlas of the map (design §4.3): one SVG image and its JSON index in client/public/atlas.
// The pictures are original work of this project, released under CC0 (see client/public/atlas/LICENSE.md), so the
// art can be swapped for another tileset by replacing the two files without code changes.
// Run: node scripts/build-atlas.mjs

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const TILE = 32
const COLUMNS = 8
const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'client', 'public', 'atlas')

const RESOURCE_COLORS = {
  gold: ['#facc15', '#a16207'],
  iron: ['#94a3b8', '#475569'],
  stone: ['#a8a29e', '#57534e'],
  wood: ['#b45309', '#78350f'],
  oil: ['#312e81', '#0f0d2e'],
  crystal: ['#e879f9', '#86198f']
}

// How full a deposit looks: the number of rocks drawn
const FILL_LEVELS = { full: 5, half: 3, low: 1 }
const ROCKS = [
  [16, 18, 8],
  [9, 12, 5],
  [22, 11, 5],
  [10, 23, 4],
  [23, 23, 4]
]

const ground = `<rect width="32" height="32" fill="#2a2a2e"/><rect x="1" y="1" width="30" height="30" fill="none" stroke="#323238"/><circle cx="6" cy="7" r="1" fill="#3a3a42"/><circle cx="25" cy="21" r="1" fill="#3a3a42"/>`

const resource = ([light, dark], rocks) =>
  ground +
  ROCKS.slice(0, rocks)
    .map(
      ([x, y, r]) =>
        `<circle cx="${x}" cy="${y}" r="${r}" fill="${dark}"/><circle cx="${x - 1}" cy="${y - 1}" r="${r - 1.5}" fill="${light}"/>`
    )
    .join('')

const item = (color) =>
  ground + `<rect x="9" y="9" width="14" height="14" rx="2" fill="${color}" stroke="#0e7490" stroke-width="2"/>`

const sprites = {
  ground,
  item_generic: item('#22d3ee'),
  item_blueprint:
    ground +
    `<rect x="7" y="8" width="18" height="16" fill="#1d4ed8" stroke="#93c5fd" stroke-width="1.5"/><path d="M10 13h12M10 17h12M10 21h7" stroke="#bfdbfe" stroke-width="1.5"/>`,
  item_ammunition:
    ground +
    `<rect x="11" y="7" width="4" height="18" rx="2" fill="#fbbf24"/><rect x="17" y="7" width="4" height="18" rx="2" fill="#fbbf24"/>`,
  item_part:
    ground +
    `<circle cx="16" cy="16" r="8" fill="#a1a1aa" stroke="#52525b" stroke-width="2"/><circle cx="16" cy="16" r="3" fill="#27272a"/>`,
  chassis_wheels:
    ground +
    `<rect x="7" y="6" width="18" height="20" rx="3" fill="#d4d4d8"/><circle cx="6" cy="9" r="3" fill="#3f3f46"/><circle cx="26" cy="9" r="3" fill="#3f3f46"/><circle cx="6" cy="23" r="3" fill="#3f3f46"/><circle cx="26" cy="23" r="3" fill="#3f3f46"/>`,
  chassis_tracks:
    ground +
    `<rect x="4" y="5" width="6" height="22" rx="2" fill="#3f3f46"/><rect x="22" y="5" width="6" height="22" rx="2" fill="#3f3f46"/><rect x="9" y="7" width="14" height="18" rx="3" fill="#d4d4d8"/>`,
  chassis_immobile:
    ground +
    `<rect x="6" y="8" width="20" height="18" rx="2" fill="#d4d4d8"/><rect x="10" y="12" width="12" height="10" fill="#a1a1aa"/>`,
  base:
    ground +
    `<rect x="3" y="3" width="26" height="26" rx="3" fill="#d4d4d8" stroke="#52525b" stroke-width="2"/><rect x="9" y="9" width="14" height="14" fill="#71717a"/><circle cx="16" cy="16" r="3" fill="#e4e4e7"/>`,
  base_corpse:
    ground +
    `<path d="M3 29 5 8 14 4 20 12 29 9 27 29Z" fill="#52525b" stroke="#27272a" stroke-width="2"/><path d="M12 29 15 17 20 24" stroke="#18181b" stroke-width="2" fill="none"/>`,
  overlay_weapon: `<rect x="14" y="2" width="4" height="14" fill="#18181b"/><circle cx="16" cy="17" r="5" fill="#52525b"/>`,
  overlay_drill: `<path d="M16 3 21 15 11 15Z" fill="#fbbf24" stroke="#78350f"/><rect x="13" y="15" width="6" height="5" fill="#52525b"/>`,
  overlay_scanner: `<path d="M8 12a10 10 0 0 1 16 0" stroke="#7dd3fc" stroke-width="2" fill="none"/><path d="M11 15a6 6 0 0 1 10 0" stroke="#7dd3fc" stroke-width="2" fill="none"/><circle cx="16" cy="19" r="2" fill="#7dd3fc"/>`,
  overlay_antenna: `<path d="M16 22V6" stroke="#e4e4e7" stroke-width="2"/><circle cx="16" cy="5" r="2.5" fill="#f87171"/>`,
  overlay_solar: `<rect x="6" y="8" width="20" height="14" rx="2" fill="#1e3a8a" stroke="#93c5fd" stroke-width="1.5"/><path d="M13 8v14M19 8v14M6 15h20" stroke="#60a5fa" stroke-width="1"/>`,
  overlay_cracked: `<path d="M5 6 12 14 8 18 17 25 14 30M20 3 17 11 25 16 22 22" stroke="#09090b" stroke-width="1.5" fill="none"/>`
}

for (const [name, colors] of Object.entries(RESOURCE_COLORS)) {
  for (const [level, rocks] of Object.entries(FILL_LEVELS)) {
    sprites[`resource_${name}_${level}`] = resource(colors, rocks)
  }
}

const names = Object.keys(sprites)
const rows = Math.ceil(names.length / COLUMNS)
const frames = {}
const body = names
  .map((name, index) => {
    const x = (index % COLUMNS) * TILE
    const y = Math.floor(index / COLUMNS) * TILE
    frames[name] = { x, y, w: TILE, h: TILE }

    return `<svg x="${x}" y="${y}" width="${TILE}" height="${TILE}" viewBox="0 0 32 32">${sprites[name]}</svg>`
  })
  .join('\n')

mkdirSync(outDir, { recursive: true })
writeFileSync(
  join(outDir, 'atlas.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" width="${COLUMNS * TILE}" height="${rows * TILE}">\n${body}\n</svg>\n`
)
writeFileSync(
  join(outDir, 'atlas.json'),
  JSON.stringify({ image: 'atlas.svg', tileSize: TILE, frames }, null, 2) + '\n'
)
