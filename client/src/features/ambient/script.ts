import { GameEvent } from '@lib/utils/interfaces/events'
import { RESOURCE } from '@lib/utils/interfaces/resources'
import { MapCell } from '../map/renderer/model'

// The scripted story of the ambient scene (design §15.3): a miner shuttles between its base and a deposit, a gunner trades
// shots with an enemy and gets a module broken, and a repair bot comes to mend it. It is a pure function of the step number
// (no clock, no randomness), so the scene repeats exactly and a test can walk through it.

export const SCENE_COLUMNS = 20
export const SCENE_ROWS = 12
// The steps of one full story; the scene then starts over
export const SCENE_STEPS = 32

const USER = 'ambient'
const BASE = { x: 2, y: 2 }
const DEPOSIT = { x: 9, y: 2 }
const GUNNER = { x: 12, y: 7 }
const ENEMY = { x: 17, y: 7 }
const REPAIR_HOME = { x: 6, y: 9 }

export interface Spot {
  x: number
  y: number
}

export interface SceneFrame {
  cells: MapCell[]
  events: GameEvent[]
  // Cells where a repair is going on, which no game event describes yet
  repairs: Spot[]
}

const cell = (spot: Spot, content: MapCell['content'], step: number): MapCell => ({
  ...spot,
  content,
  seenAt: step,
  isLive: false
})

const place = (spot: Spot) => ({ ...spot, z: 0 })

const party = (botId: string) => [{ userId: USER, botId }] as GameEvent['parties']

// Walks along a row from `from` to `to`, one cell per step from `startStep` on, and then stays there
function walk(from: Spot, to: Spot, startStep: number, step: number): Spot {
  const length = Math.abs(to.x - from.x)
  const done = Math.min(length, Math.max(0, step - startStep))

  return { x: from.x + Math.sign(to.x - from.x) * done, y: from.y }
}

function minerAt(step: number): Spot {
  if (step < 8) {
    return walk({ x: BASE.x + 1, y: BASE.y }, { x: DEPOSIT.x - 1, y: DEPOSIT.y }, 0, step)
  }
  if (step < 12) {
    return { x: DEPOSIT.x - 1, y: DEPOSIT.y }
  }

  return walk({ x: DEPOSIT.x - 1, y: DEPOSIT.y }, { x: BASE.x + 1, y: BASE.y }, 12, Math.min(step, 19))
}

function repairBotAt(step: number): Spot {
  const target = { x: GUNNER.x - 1, y: GUNNER.y + 1 }

  if (step < 14) {
    return REPAIR_HOME
  }
  if (step < 20) {
    return { x: Math.min(target.x, REPAIR_HOME.x + (step - 14)), y: REPAIR_HOME.y - Math.min(1, step - 14) }
  }

  return { x: target.x, y: REPAIR_HOME.y - 1 }
}

const isGunnerBroken = (step: number) => step >= 15 && step < 24

const shotSteps = [3, 7, 11, 15]

export function sceneFrame(rawStep: number): SceneFrame {
  const step = ((rawStep % SCENE_STEPS) + SCENE_STEPS) % SCENE_STEPS
  const miner = minerAt(step)
  const repairer = repairBotAt(step)
  const events: GameEvent[] = []
  const repairs: Spot[] = []
  const at = step * 400

  for (const [botId, now, before] of [
    ['miner', miner, minerAt(step - 1)],
    ['repairer', repairer, repairBotAt(step - 1)]
  ] as const) {
    if (step > 0 && (now.x !== before.x || now.y !== before.y)) {
      events.push({ type: 'BotMoved', at, parties: party(botId), from: place(before), to: place(now) })
    }
  }
  if (step >= 8 && step < 12) {
    events.push({
      type: 'ResourceMined',
      at,
      parties: party('miner'),
      location: place(miner),
      resource: RESOURCE.IRON,
      amount: 5
    })
  }
  if (step === 12) {
    events.push({
      type: 'DepositDepleted',
      at,
      parties: party('miner'),
      location: place(DEPOSIT),
      resource: RESOURCE.IRON
    })
  }
  if (shotSteps.includes(step)) {
    events.push({
      type: 'ShotFired',
      at,
      parties: party('gunner'),
      location: place(GUNNER),
      target: place(ENEMY),
      rounds: 1
    })
  }
  if (shotSteps.includes(step - 1)) {
    events.push({
      type: 'ShotHit',
      at,
      parties: party('gunner'),
      location: place(ENEMY),
      hits: 1,
      victimBotId: 'enemy'
    })
  }
  if (step === 15) {
    events.push({ type: 'ModuleBroken', at, parties: party('gunner'), location: place(GUNNER), moduleId: 'weapon' })
  }
  if (step >= 20 && step < 24) {
    repairs.push(GUNNER)
  }
  if (step === 8) {
    events.push({ type: 'ScanCompleted', at, parties: party('repairer'), location: place(REPAIR_HOME), cells: 16 })
  }

  const cells: MapCell[] = [
    cell(BASE, { kind: 'base', owner: 'own', isCorpse: false }, step),
    cell(
      DEPOSIT,
      step < 12 ? { kind: 'resource', resource: RESOURCE.IRON, amount: 20, capacity: 20 } : { kind: 'empty' },
      step
    ),
    cell(
      miner,
      { kind: 'bot', owner: 'own', chassis: 'wheels', overlays: ['drill'], isDamaged: false, isStale: false },
      step
    ),
    cell(
      GUNNER,
      {
        kind: 'bot',
        owner: 'own',
        chassis: 'tracks',
        overlays: ['weapon'],
        isDamaged: isGunnerBroken(step),
        isStale: false
      },
      step
    ),
    cell(
      ENEMY,
      { kind: 'bot', owner: 'enemy', chassis: 'tracks', overlays: ['weapon'], isDamaged: step >= 8, isStale: false },
      step
    ),
    cell(
      repairer,
      { kind: 'bot', owner: 'own', chassis: 'wheels', overlays: ['antenna'], isDamaged: false, isStale: false },
      step
    ),
    cell({ x: 15, y: 3 }, { kind: 'resource', resource: RESOURCE.STONE, amount: 80, capacity: 120 }, step),
    cell({ x: 4, y: 7 }, { kind: 'resource', resource: RESOURCE.CRYSTAL, amount: 30, capacity: 60 }, step)
  ]

  return { cells, events, repairs }
}
