[← README](../../../README.md)

# The MCP server

`mcp/` is an [MCP](https://modelcontextprotocol.io) server that lets an AI play Bot RTS as a **regular player**. It is a thin client of
the [public API](./API.md): it calls `/api/v1` with the player's **API key** and has no access to the database or the engine. The AI
has no special rules: energy, the operations budget, cooldowns, the category switches and the scopes of the key apply, exactly as for
any client.

## Giving an AI a key

Create an API key in the account page of the game and give it only the scopes the AI should have: for example `read` + `movement` +
`extraction` for a scout that can look and move but cannot write files, run scripts or shoot. A tool the key does not allow answers
with `API_KEY_SCOPE`, which the AI can read. Revoking the key ends the session at once.

## Running it

**stdio** (a local MCP client such as Claude Desktop or Claude Code starts the server itself):

```bash
npm run build -w mcp
# in the MCP client's configuration:
#   command: node
#   args:    ["/path/to/bot-rts/mcp/ts-built/mcp/src/index.js"]
#   env:     BOTRTS_API_URL=https://play.example   BOTRTS_API_KEY=botrts_...
```

**Streamable HTTP** (hosted; stateless, so it scales like the API):

```bash
MCP_TRANSPORT=http MCP_HOST=0.0.0.0 MCP_PORT=3000 BOTRTS_API_URL=https://play.example \
  node mcp/ts-built/mcp/src/index.js
```

Each client sends its own key, `Authorization: Bearer botrts_…`, to `POST /mcp`, and plays as that player; a key set in
`BOTRTS_API_KEY` is the fallback. `GET /health` is for the load balancer. Put it behind TLS.

| Variable | Default | Meaning |
| --- | --- | --- |
| `BOTRTS_API_URL` | `http://localhost:8080` | The game's API |
| `BOTRTS_API_KEY` | – | The key (required for stdio) |
| `MCP_TRANSPORT` | `stdio` | `stdio` or `http` |
| `MCP_HOST`, `MCP_PORT` | `127.0.0.1`, `3000` | Where the HTTP transport listens |

## The tools

Every tool names the key scope it needs in its description.

| Group | Tools | Scope |
| --- | --- | --- |
| Observation | `get_me`, `list_bots`, `list_base_bots`, `get_bot_modules`, `get_storage`, `get_map`, `get_bot_view`, `get_terminal_history`, `list_notifications`, `get_game_time`, `list_recipes`, `get_factory`, `list_scripts`, `list_drives`, `list_files`, `read_file` | `read` |
| Start | `deploy_base` | `base` |
| Manual control | `bot_<function>` for each function of the script API: `bot_scan`, `bot_view`, `bot_get_location`, `bot_get_link_status` (`read`); `bot_move`, `bot_turn` (`movement`); `bot_aim`, `bot_shoot`, `bot_reload` (`combat`); `bot_dig`, `bot_mine`, `bot_pick`, `bot_take`, `bot_drop` (`extraction`); `bot_enable`, `bot_disable` (`maintenance`) | the category of the action |
| Fabrication | `craft_module`, `research_module`, `learn_blueprint`, `assemble_bot` (`fabrication`); `repair_module`, `disassemble_module` (`maintenance`) | as named |
| Files | `write_file`, `delete_file`, `make_directory` | `files` |
| Scripts | `run_script`, `kill_script` | `scripts` |

The manual-control tools are made from the same list of functions the engine enforces (`lib/utils/script-api.ts`), so a function added to
the game gets a tool without new code. A typical session: `list_bots` → `bot_scan` → `get_map` → `write_file` (a script) →
`run_script` → `get_terminal_history`.

## Tests

`mcp/` has unit tests (a fake game API, the SDK's own client over an in-memory transport and over HTTP) with the 97 % gate, and
`api/src/mcp.int.test.ts` runs the server against the real API on a seeded database. The end-to-end spec of Phase 8.13 plays a scan and a
move through it with the engine running.
