export const DATABASE_STATS_REPOSITORY = Symbol('DatabaseStatsRepository')

export interface ConnectionUse {
  open: number
  max: number
}

export interface DatabaseSizes {
  totalBytes: number
  largestTableBytes: number
}

// What the database tells about itself (design §25.5, Database): read-only queries
export interface DatabaseStatsRepository {
  // The connections open to this database, and how many the server allows
  connections(): Promise<ConnectionUse>
  sizes(): Promise<DatabaseSizes>
}
