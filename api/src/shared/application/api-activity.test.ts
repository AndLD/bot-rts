import { ApiActivity } from './api-activity'

describe('ApiActivity', () => {
  it('counts the sockets open and the players on them: a player with two tabs is one player', () => {
    const activity = new ApiActivity()

    activity.socketOpened('alice', 0)
    activity.socketOpened('alice', 1)
    activity.socketOpened('bob', 2)
    activity.socketOpened(undefined, 3)
    expect(activity.snapshot()).toMatchObject({
      socketsOpen: 4,
      onlinePlayers: 2,
      socketConnects: 4,
      socketReconnects: 0
    })

    activity.socketClosed('alice', 10)
    expect(activity.snapshot()).toMatchObject({ socketsOpen: 3, onlinePlayers: 2 })
    activity.socketClosed('alice', 11)
    activity.socketClosed(undefined, 12)
    expect(activity.snapshot()).toMatchObject({ socketsOpen: 1, onlinePlayers: 1 })
  })

  it('counts a player who comes back within a minute as a reconnect, and one who comes back later as an arrival', () => {
    const activity = new ApiActivity()
    activity.socketOpened('alice', 0)
    activity.socketOpened('bob', 0)
    activity.socketClosed('alice', 1_000)
    activity.socketClosed('bob', 1_000)

    activity.socketOpened('alice', 30_000)
    activity.socketOpened('bob', 200_000)

    expect(activity.snapshot()).toMatchObject({ socketConnects: 4, socketReconnects: 1 })
  })

  it('forgets the players who left long ago, and does not go below zero', () => {
    const activity = new ApiActivity()
    activity.socketOpened('alice', 0)
    activity.socketClosed('alice', 0)
    activity.socketOpened('bob', 500_000)
    activity.socketClosed('bob', 500_000)
    activity.socketClosed(undefined, 500_001)
    activity.socketClosed(undefined, 500_002)

    expect(activity.snapshot().socketsOpen).toBe(0)
    activity.socketOpened('alice', 500_010)
    expect(activity.snapshot().socketReconnects).toBe(0)
  })

  it('counts the requests the rate limit refused and the emails the mail server refused', () => {
    const activity = new ApiActivity()

    activity.rateLimitHit()
    activity.rateLimitHit()
    activity.emailFailed()

    expect(activity.snapshot()).toMatchObject({ rateLimitHits: 2, emailFailures: 1 })
  })

  it('closes a socket of a player it never saw open without going below zero', () => {
    const activity = new ApiActivity()

    activity.socketClosed('ghost', 1_000)

    expect(activity.snapshot()).toMatchObject({ socketsOpen: 0, onlinePlayers: 0 })
  })

  it('keeps a player online while another socket of theirs is open', () => {
    const activity = new ApiActivity()
    activity.socketOpened('alice', 0)
    activity.socketOpened('alice', 1)

    activity.socketClosed('alice', 2)

    expect(activity.snapshot()).toMatchObject({ socketsOpen: 1, onlinePlayers: 1 })
  })
})
