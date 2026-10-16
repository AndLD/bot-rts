export const JOB_STATS_REPOSITORY = Symbol('JobStatsRepository')

export interface NotificationQueue {
  // Notifications whose time has come and that have not been delivered
  waiting: number
  // How long the oldest of them has been waiting (ms); null when none is
  oldestWaitMs: number | null
}

// What the jobs of the game leave in the database for the console to measure (design §25.5, Jobs and notifications)
export interface JobStatsRepository {
  notificationQueue(): Promise<NotificationQueue>
}
