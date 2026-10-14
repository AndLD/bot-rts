[← README](../README.md)

# Deployment and scaling

## Processes

| Process                        | Role (`APP_ROLE`) | Count                       | Needs                  |
| ------------------------------ | ----------------- | --------------------------- | ---------------------- |
| API + engine thread (default)  | `all`             | 1                           | PostgreSQL             |
| API node                       | `api`             | any number                  | PostgreSQL, Redis      |
| Engine node                    | `engine`          | **exactly 1**               | PostgreSQL, Redis      |
| Client (Next.js)               | –                 | any number (e.g. Vercel)    | the public API URL     |

The game world has one authoritative owner, the engine (design §12.2.2, §14.2), so the engine node is never replicated:
two engine nodes would both write the world. The API tier is stateless and scales horizontally.

## How the nodes work together

- **Requests that change the world** (deploying a base, crafting, scripts, manual control) are sent by an `api` node to the
  engine node over Redis pub/sub (`botrts:engine:requests`; the answer comes back on a channel of the asking node). When no
  engine node is listening the API answers `503 SERVICE_UNAVAILABLE` at once; when it does not answer within
  `ENGINE_REQUEST_TIMEOUT_MS` the request fails the same way.
- **Events to players** (script logs, radio, map vision, notifications, achievements) are emitted by the engine node into the
  player's Socket.IO room `user:<id>`. The Socket.IO Redis adapter delivers them to the node the player is connected to.
- **Sockets are stateless:** the handshake token identifies the player on whichever node accepts the connection, and the room
  is joined there. The official client connects with the WebSocket transport only, so a load balancer needs no sticky
  sessions for it. Third-party clients that use HTTP long polling need sticky routing (by client IP or cookie) on `/socket.io`.
- **Reads** are answered by the API node from PostgreSQL.

## Configuration

| Variable                    | Where          | Meaning                                                              |
| --------------------------- | -------------- | -------------------------------------------------------------------- |
| `APP_ROLE`                  | every node     | `all`, `api` or `engine`                                             |
| `REDIS_URL`                 | `api`, `engine`| Required for those roles; with `all` it only enables the adapter     |
| `ENGINE_REQUEST_TIMEOUT_MS` | `api`          | How long to wait for the engine node (default 15000)                 |
| `TRUST_PROXY`               | every node     | `true` behind the load balancer                                      |

Locally `npm run db:up` starts PostgreSQL and Redis (`docker-compose.yml`).

## Reverse proxy

Terminate TLS at the proxy, forward `X-Forwarded-*`, set `TRUST_PROXY=true`, and allow WebSocket upgrades on `/socket.io`.
