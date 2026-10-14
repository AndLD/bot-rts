import { z } from 'zod'
import { baseId, botId, defineTool } from './types'

// Looking at the game. Nothing here changes it, so a key with the `read` scope can use all of it.
const read = { scope: 'read', isReadOnly: true } as const

export const observationTools = [
  defineTool({
    ...read,
    name: 'get_me',
    title: 'Who am I',
    description: 'The player this API key acts as: name, email and status.',
    inputSchema: {},
    run: (client) => client.get('/users/me')
  }),
  defineTool({
    ...read,
    name: 'list_bots',
    title: 'List my bases and bots',
    description:
      'All the bases and bots of the player, with their place. Start here to learn the ids the other tools need.',
    inputSchema: { type: z.enum(['base', 'worker']).optional().describe('Only bases, or only the bots built by them') },
    run: (client, { type }) => client.get('/bots', { type })
  }),
  defineTool({
    ...read,
    name: 'list_base_bots',
    title: 'List the bots of a base',
    description: 'The bots that belong to one base.',
    inputSchema: { baseId },
    run: (client, input) => client.get(`/bots/${input.baseId}/bots`)
  }),
  defineTool({
    ...read,
    name: 'get_bot_modules',
    title: 'Modules of a bot',
    description: 'The modules of a bot (scanner, engine, weapon, drive, …) with their condition and properties.',
    inputSchema: { botId },
    run: (client, input) => client.get(`/bots/${input.botId}/modules`)
  }),
  defineTool({
    ...read,
    name: 'get_storage',
    title: 'What a bot carries',
    description: 'The resources and items a bot carries, and its capacity.',
    inputSchema: { botId },
    run: (client, input) => client.get(`/bots/${input.botId}/storage`)
  }),
  defineTool({
    ...read,
    name: 'get_map',
    title: 'The known map',
    description:
      'What the player knows of the cells in a rectangle (fog of war applies: cells never seen are not there). Use bot_scan to see more.',
    inputSchema: {
      minX: z.number().int(),
      minY: z.number().int(),
      maxX: z.number().int(),
      maxY: z.number().int()
    },
    run: (client, input) => client.get('/map', input)
  }),
  defineTool({
    ...read,
    name: 'get_bot_view',
    title: 'The surroundings of a bot',
    description: 'The map around a bot as the bot sees it now.',
    inputSchema: { botId },
    run: (client, input) => client.get(`/map/bots/${input.botId}`)
  }),
  defineTool({
    ...read,
    name: 'get_terminal_history',
    title: 'Terminal and script log of a bot',
    description: 'The newest lines of the terminal of a bot, including what its scripts wrote, oldest first.',
    inputSchema: {
      botId,
      limit: z.number().int().min(1).max(1000).optional().describe('How many lines (default 100)')
    },
    run: (client, input) => client.get(`/bots/${input.botId}/terminal-history`, { limit: input.limit })
  }),
  defineTool({
    ...read,
    name: 'list_notifications',
    title: 'Notifications',
    description: 'What the game told the player: attacks, damage, finished scripts, low energy, …',
    inputSchema: {
      limit: z.number().int().min(1).max(100).optional(),
      unread: z.boolean().optional().describe('Only the ones not yet read')
    },
    run: (client, input) => client.get('/notifications', input)
  }),
  defineTool({
    ...read,
    name: 'get_game_time',
    title: 'Game time',
    description: 'The server time and the day / night configuration (solar panels produce by day).',
    inputSchema: {},
    run: (client) => client.get('/time')
  }),
  defineTool({
    ...read,
    name: 'list_recipes',
    title: 'Recipes',
    description: 'The modules the player can craft or research, with their costs.',
    inputSchema: {},
    run: (client) => client.get('/crafting/recipes')
  }),
  defineTool({
    ...read,
    name: 'get_factory',
    title: 'Factory of a base',
    description: 'The jobs the factory of a base is working on, and the parts and blueprints it holds.',
    inputSchema: { baseId },
    run: (client, input) => client.get(`/bots/${input.baseId}/factory`)
  })
]
