[← README](../../../README.md)

# The public API

Everything the web client does goes through one versioned API, `/api/v1` (REST and Socket.IO), and the same API is open to your own
clients, scripts and AI assistants. There are no private endpoints for the official client.

- **Reference:** the live Swagger UI is at `/api/docs`, and the OpenAPI document at `/api/docs-json`; the document is also kept in
  the repository as [`api/openapi.json`](../../../api/openapi.json) and checked against the code in CI. Every operation has a request
  example, a response example and a `curl` sample (`x-codeSamples`), and names the key scope it needs (`x-api-key-scope`).
- **Rules:** a client has no advantage over the web client. The same energy, operations budget, cooldowns and category switches
  apply, and the single authoritative engine decides every conflict.

## Public routes

A few routes need no key and no session: `GET /api/v1/health` (liveness and readiness), `GET /api/v1/maintenance` (whether the world is paused
for maintenance, and the banner of a scheduled maintenance while it is shown), and the sign-up and sign-in routes (`GET /api/v1/metrics` has its own
bearer token). Every other
route asks for a session or a key. The routes under `/api/v1/admin/*` are for the admin console only: they are never reachable with a key.

## Signing in

Send `Authorization: Bearer <token>` with either:

| Token               | For                  | How you get it                                             |
| ------------------- | -------------------- | ---------------------------------------------------------- |
| a **session** token | the web client       | `POST /api/v1/auth/login` (short-lived; refreshed by cookie) |
| an **API key**      | everything else      | created in the account page of the game, `botrts_…`        |

A key is shown **once** when you create it and only its hash is stored. It acts as you, under your rules, and is limited to the
scopes you gave it; it can be revoked at any time and may expire. A player holds at most 10 active keys.

```bash
export BOTRTS_URL=https://play.example BOTRTS_KEY=botrts_...
curl -H "Authorization: Bearer $BOTRTS_KEY" "$BOTRTS_URL/api/v1/bots"
curl -X POST "$BOTRTS_URL/api/v1/bots/$BASE/executions" -H "Authorization: Bearer $BOTRTS_KEY" \
     -H "Content-Type: application/json" -d '{"file":"/memory-class1/main.js","args":[3]}'
```

For Socket.IO pass the key as `auth: { token }` in the handshake; the events are listed in `lib/utils/socket-events.ts`.

### Scopes

A scope can only **narrow** what you may do. Every route and socket event names the scope it needs; one that names none is closed to
keys. Account, settings, key-management and administration routes are **session-only**: a key cannot reach them whatever its scopes.

| Scope | Allows |
| --- | --- |
| `read` | everything that only looks: bases, bots, modules, the map, files, storage, notifications, achievements, the list of scripts, terminal history, and observation actions such as `scan` |
| `base` | deploying a base |
| `files` | writing and deleting files and directories |
| `scripts` | starting and stopping scripts (`POST /bots/{botId}/executions`, `DELETE /executions/{id}`) |
| `terminal` | opening BotOS terminal sessions and running commands (what the commands can do, so grant it with care) |
| `movement` `combat` `extraction` `logistics` `fabrication` `maintenance` `communication` `trade` | the manual actions of that category (`POST /bots/{botId}/actions`), and for `fabrication` and `maintenance` their endpoints |

### Limits

Each key has its own rate limit per minute (default 120, at most 6000), counted across all API nodes. Answers carry
`X-RateLimit-Limit` and `X-RateLimit-Remaining`; past the limit the API answers `429` with `Retry-After`. Requests without a key are
limited per address. JSON bodies are limited to 256 KiB.

## Errors

Every failure has the same body, whichever way you signed in:

```json
{ "statusCode": 403, "code": "API_KEY_SCOPE", "error": "This API key does not have the \"files\" scope" }
```

Branch on `code`, never on the text. The codes are listed in the `ErrorResponseModel` of the reference; the ones keys meet are
`UNAUTHORIZED` (missing, wrong, revoked or expired key), `API_KEY_SCOPE`, `SESSION_ONLY`, `TOO_MANY_REQUESTS`.

## Stability

The API is versioned in the path. Within `/api/v1`:

- **Compatible changes** may happen at any time: new endpoints, new optional request fields, new response fields, new events, new
  error codes, new enum values in responses. Clients must ignore what they do not know.
- **Breaking changes** (removing or renaming a field, endpoint, event or scope, tightening validation, changing a meaning) are
  never made in place. They ship as a new version (`/api/v2`) next to the old one.
- **Deprecation.** A route that is going away is marked in the reference (`deprecated: true`, `x-sunset`), and every answer from it
  carries the headers `Deprecation: true`, `Sunset: <date>` and, when there is one, `Link: <replacement>; rel="successor-version"`.
  The sunset date is **at least six months** after the announcement in the [changelog](../CHANGELOG.md), and a deprecated route keeps
  working, with the same behaviour, until then.
- **What is covered:** the routes and events of the reference, the scopes, the error codes, and the script API. Not covered: the
  `x-` extensions, the order of fields, the text of messages, the exact ids of generated content.

Contract tests keep the official client and key clients on the same API: `api/src/apikeys/contract.int.test.ts` asks the same questions
with a session and with a key and requires identical answers, and `api/src/apikeys/api-keys.int.test.ts` requires every route to
name its scope.

## Scripts over HTTP

`POST /api/v1/bots/{botId}/executions` starts `main(bot, ...args)` of a file (`/<drive>/<path>`), `GET /api/v1/executions` lists what
runs, `DELETE /api/v1/executions/{id}` stops one. Output arrives as `script-log` events on the socket and in the terminal history
(`get-terminal-history`).
