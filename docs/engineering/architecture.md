[← AGENTS.md](../../AGENTS.md) · stack: [stack.md](./stack.md) · values: [profile](../profile.md)

# Architecture

The architecture decisions of this product that code must follow: the single owner of world state, the identity-provider
abstraction and the persistence isolation. The layering of the code and the rules per layer are in
[stack §2](./stack.md#2-architecture-and-layering); the product rules these decisions serve are in the
[game design](../product-knowledge/game-design/GAME-DESIGN.md). Read this file before changing authentication, persistence
or the engine boundary.

---

## 1. Identity provider abstraction

Authentication sits behind ports so the implementation can change (the current custom auth today; Clerk or another
provider later) without touching game code.

- **`IdentityVerifier` (application port, always required):** turns a bearer token into an `Identity`
  (`{ provider, subject, email, emailVerified }`). It is used by the HTTP guard, the WebSocket guard and the MCP/API
  layers. Nothing outside the identity adapters reads provider-specific tokens or claims.
- **`CredentialAuthService` (application port, only for providers whose credentials we manage):** register, login,
  refresh, logout, verify email, resend verification, request/perform password reset, change password, change email,
  delete account. The custom adapter implements it and exposes the `/api/v1/auth/*`
  endpoints. A hosted provider such as Clerk does these steps in the browser, so its adapter does not implement this
  port and those endpoints are not mounted.
- **Own user model:** the domain `User` (internal `userId`, name, roles, `active`/ban state) is separate from login
  credentials. Provider links live in an `identities` mapping `(provider, subject) → userId`. Custom-auth secrets
  (password hash, verification tokens) live only in the custom adapter's own table. Roles and bans are always
  checked against our database, never taken from the token.
- **Provisioning:** on the first verified identity, a `UserProvisioner` creates the `User` and the identity link (lazy
  creation); webhooks, if a provider has them, are only a backup.
- **Selection:** `AUTH_PROVIDER` (`local` by default) chooses the adapter in the auth Nest module's provider factory.
- **API keys** (third-party clients, MCP) are a separate authenticator that also resolves to an internal `userId`; a
  composite guard accepts a session token or an API key.
- **Client side:** the web client talks to an `AuthClient` interface (sign in, sign up, current token, sign out) with a
  `localAuthClient` implementation over the `/api/v1/auth/*` endpoints; a hosted provider would add its own
  implementation. Components use hooks only, never the provider SDK directly.
- **Tests:** a `FakeIdentityVerifier` for Jest, and a shared contract test suite that every adapter must pass.

## 2. Persistence isolation (PostgreSQL + Prisma)

The database is an implementation detail that must stay replaceable (clean architecture / DDD):

- **Prisma stays in `infrastructure`.** The Prisma schema, migrations, `PrismaClient` and the generated types live only in
  the persistence part of the infrastructure layer. They are never imported by `domain`, `application`, `presentation`,
  `engine` or `lib`; the import-boundary check ([stack §2.1](./stack.md#21-dependency-direction-dip)) enforces it.
- **Repositories map, ports are persistence-agnostic.** A repository takes and returns **domain entities**; the mapping
  between Prisma rows and entities happens inside the adapter. Port methods express domain intent (`findByEmail`,
  `listBotsOfBase`), not SQL or Prisma query shapes.
- **Ids are domain-owned strings (UUIDs).** No database-generated ids or Prisma types leak into entities or DTOs.
- **Transactions through a port.** Use cases that need atomicity use a `UnitOfWork` port implemented with Prisma's
  `$transaction`.
- **The engine persists through a `WorldStateStore` port** (batched upserts, one database transaction per flush). The
  adapter may use `createMany` or raw SQL for performance; that stays inside the adapter.
- **Migrations are code:** `prisma migrate` files are committed, applied migrations are never edited, and destructive
  changes follow an expand/contract plan.
- Replacing the database must mean rewriting the infrastructure adapters only.

## 3. The engine as the single owner of world state

The scalability exception is by design: the **engine** is the single authoritative in-memory owner of world state (persisted
to PostgreSQL by write-behind) and is reached only through a port (see
`docs/product-knowledge/game-design/12-real-time-execution-model.md` §12.2.2 and §14.2). The product rule it serves is the
single writer of world state (`AGENTS.md` §9).
