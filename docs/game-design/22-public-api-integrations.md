[← Game design index](../GAME-DESIGN.md)

# 22. Public API & integrations

## 22.1 Public API ✅

- **Goal:** developers can build their own game interface (alternative clients, dashboards, tools) against the backend.
- A documented, **versioned `/api/v1`** REST + WebSocket surface exposes everything the official client uses: read state
  (own bases, bots, modules, known map, storage), manual-control commands (§15.1), terminal sessions, file CRUD, and
  script run/kill. **The official client is built on this same API**, exactly like any custom client: it has no private or hidden
  endpoints, so every feature of the official client is available to third-party clients. The surface has **two
  authentication methods**: the user's login session (JWT) for the official client, and API keys for third-party
  clients and the MCP server. All new endpoints are created under `/api/v1` from the start, never retrofitted.
- **API keys:** a player creates keys in their profile. A key is shown **once** and stored **hashed**. Each key has
  **scopes** (for example read, one scope per control category from §15.1, files, scripts) that can only **narrow** the
  player's own rights, plus its own rate limit, and can be **revoked** at any time.
- A key acts **as that player** and obeys exactly the same game rules: processor budget, energy, cooldowns, category
  switches (§15.1), and the single-writer engine (§14.2). An API client never gets an advantage over the official one.
- Notifications (§24) and achievements (§23) are available through the API (scope `read`), so custom clients and the MCP
  server can show and react to them.
- An **OpenAPI specification** is published and kept in sync with the code.
- Account and admin operations (settings, user management, API key creation itself) are **not** available through API keys.

## 22.2 MCP server ✅

- A **separate `mcp/` package** (a workspace in the monorepo) provides an MCP server that lets an AI play as a regular
  player. It is a thin layer over the public API (§22.1) and uses the player's **API key**; it has **no direct access** to
  the database or the engine.
- **Tools mirror the game:** observation (state, known map, terminal and script logs), manual control per category
  (§15.1), file read/write, run/kill script, craft/assemble/research.
- **The AI is just another player:** server-side the same rules apply as for any client — processor budget, energy,
  cooldowns, category switches and the key's scopes. A player can give the AI a restricted key (for example read +
  movement only). The AI has no special rules and is not labelled in the game.
- **Transport:** stdio for local use and streamable HTTP for hosted use.

## 22.3 Spawn seeds ✅

Spawn seeds let several players start near each other (also described in §4.1).

- In the Deploy dialog a player can **create a seed code** (for example `ALPHA-7K2`); other players **enter the same code**
  when they deploy.
- The **first deploy** with a code sets the seed's **anchor point**, chosen by the normal base-spawn rule (§4.1).
- Later players with that code spawn on a **free cell within the seed radius** of the anchor (default 12 cells). They are
  exempt from the 30-cell minimum distance **only against bases with the same seed**; they must still be 30 cells from
  all other bases.
- **Limits** (tunable): at most 8 players per seed; a seed closes after 24 hours or when full.
- Seeds are used **only at deploy time** and grant no alliance, no shared map and no other bonus (map knowledge stays
  private, §4.2). A redeploy after base loss (§6.3) may use a seed again.
