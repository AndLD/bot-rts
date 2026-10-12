import { RESOURCE } from '@lib/utils/interfaces/resources'

// What the map renderer draws. It is framework-free: the data comes in as plain objects and nothing here knows React,
// sockets or the API (design §4.3).

export type Chassis = 'wheels' | 'tracks' | 'immobile'

// The key modules that get an icon on the bot's sprite
export type ModuleOverlay = 'weapon' | 'drill' | 'scanner' | 'antenna'

export type Owner = 'own' | 'enemy'

export type ItemKind = 'blueprint' | 'ammunition' | 'part' | 'generic'

export type CellContent =
  | { kind: 'empty' }
  | { kind: 'resource'; resource: RESOURCE; amount: number; capacity: number }
  | { kind: 'item'; item: ItemKind }
  | {
      kind: 'bot'
      // The bot's id, to open its control panel
      botId?: string
      owner: Owner
      chassis: Chassis
      overlays: readonly ModuleOverlay[]
      // Modules that are broken or badly damaged: the sprite gets a cracked overlay (design §8.4.1)
      isDamaged: boolean
      isStale: boolean
      // Bars of radio signal, 0-4; absent when the bot is not connected
      signal?: number
      // The bot has no radio link to its base: hatched grey, drawn where it was last known (design §11.2.1)
      linkLostAt?: number
    }
  | { kind: 'base'; botId?: string; owner: Owner; isCorpse: boolean }

// A cell as the player knows it
export interface MapCell {
  x: number
  y: number
  content: CellContent
  // The game tick of the snapshot
  seenAt: number
  // The cell is inside a live area (design §4.4): drawn at full strength with an outline
  isLive: boolean
}

// A radio link between two cells, for the optional overlay
export interface MapLink {
  from: { x: number; y: number }
  to: { x: number; y: number }
  isBroken: boolean
}

export interface Camera {
  // The world position (in cells, fractions allowed) at the middle of the canvas
  centerX: number
  centerY: number
  zoom: number
}

export interface Size {
  width: number
  height: number
}

export interface CellRange {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export const cellKey = (x: number, y: number) => `${x},${y}`
