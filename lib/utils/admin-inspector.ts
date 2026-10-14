import type { GameEvent } from './interfaces/events'

// The Inspector and the world map of the admin console (design §25.3)
export const HEATMAP_KINDS = ['density', 'depletion', 'activity'] as const

export type HeatmapKind = (typeof HEATMAP_KINDS)[number]

// The side, in cells, of the largest area a heatmap is asked for, and of its buckets
export const HEATMAP_MAX_SIDE = 512
export const HEATMAP_BUCKETS = [8, 16, 32, 64] as const

export interface IInspectorModule {
  _id: string
  type: string
  name: string
  condition: number
  maxCondition: number
  weight: number
  // Each property as JSON text, for display
  props: Record<string, string>
}

export interface IInspectorExecution {
  _id: string
  file: string
  status: 'active' | 'finished' | 'killed'
  restarts: number
  reason: string | null
  createdAt: number
  endedAt: number | null
}

export interface IInspectorLog {
  at: number
  kind: string
  text: string
}

export interface IInspectorDrive {
  _id: string
  name: string
  quota: number
  usedBytes: number
}

export interface IInspectorBot {
  _id: string
  label: string | null
  type: 'base' | 'worker'
  ownerId: string | null
  ownerName: string | null
  baseId: string | null
  position: { x: number; y: number } | null
  heading: number
  energy: { stored: number; capacity: number }
  storage: Array<{ resource: string; amount: number }>
  modules: IInspectorModule[]
  drives: IInspectorDrive[]
  executions: IInspectorExecution[]
  logs: IInspectorLog[]
}

export interface IInspectorFile {
  path: string
  kind: 'file' | 'directory'
  size: number
}

export interface IInspectorFileContent {
  path: string
  size: number
  content: string
}

export const SEARCH_RESULT_KINDS = ['bot', 'base', 'player', 'cell'] as const

export type SearchResultKind = (typeof SEARCH_RESULT_KINDS)[number]

export interface IInspectorSearchResult {
  kind: SearchResultKind
  // The id of the bot, the base or the player; for a cell, the id of what stands there, when something does
  id: string | null
  label: string
  x: number | null
  y: number | null
}

export interface IHeatBucket {
  // The corner of the bucket, in cells
  x: number
  y: number
  // 0..1 relative to the busiest bucket of the answer, and the raw number behind it
  intensity: number
  value: number
}

export interface IHeatmap {
  kind: HeatmapKind
  bucket: number
  buckets: IHeatBucket[]
}

// A game event, as the live tail shows it
export interface ITailEvent {
  userId: string
  event: GameEvent
}
