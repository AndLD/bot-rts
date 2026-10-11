import { Module } from '../../modules/domain/module.entity'
import { KnownPoint, MapPoint } from '../../map/domain/map-point.entity'

export const WORLD_STATE_STORE = Symbol('WorldStateStore')

// Everything the engine changed since the previous flush
export interface WorldStateBatch {
  mapPoints: MapPoint[]
  knownPoints: KnownPoint[]
  modules: Module[]
}

export interface WorldStateStore {
  // Writes the batch as upserts in one database transaction
  flush(batch: WorldStateBatch): Promise<void>
}
