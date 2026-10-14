import { z } from 'zod'
import { baseId, botId, defineTool } from './types'

const targetBotId = z.string().describe('The bot the module belongs to')
const moduleId = z.string().describe('The id of the module (see get_bot_modules)')

export const fabricationTools = [
  defineTool({
    scope: 'fabrication',
    name: 'craft_module',
    title: 'Craft modules',
    description:
      'Orders modules from the factory of a base. It spends the resources of the base and takes time (see get_factory). Needs a known recipe (see list_recipes).',
    inputSchema: {
      baseId,
      module: z.string().describe('The module name, like scanner-class1'),
      count: z.number().int().min(1).optional()
    },
    run: (client, input) =>
      client.post(`/bots/${input.baseId}/factory/craft`, { module: input.module, count: input.count })
  }),
  defineTool({
    scope: 'fabrication',
    name: 'research_module',
    title: 'Research a module',
    description: 'Orders the research of a module the player does not know yet; a blueprint comes out of it.',
    inputSchema: { baseId, module: z.string() },
    run: (client, input) => client.post(`/bots/${input.baseId}/factory/research`, { module: input.module })
  }),
  defineTool({
    scope: 'fabrication',
    name: 'learn_blueprint',
    title: 'Learn a blueprint',
    description: 'Learns the recipe of a blueprint item the base holds.',
    inputSchema: { baseId, itemId: z.string() },
    run: (client, input) => client.post(`/bots/${input.baseId}/factory/learn`, { itemId: input.itemId })
  }),
  defineTool({
    scope: 'fabrication',
    name: 'assemble_bot',
    title: 'Assemble a bot',
    description: 'Builds a new bot of parts the base holds (a body and modules; see get_factory).',
    inputSchema: {
      baseId,
      label: z.string().nullable().optional().describe('A name for the bot'),
      partIds: z.array(z.string())
    },
    run: (client, input) =>
      client.post(`/bots/${input.baseId}/factory/assemble`, { label: input.label ?? null, partIds: input.partIds })
  }),
  defineTool({
    scope: 'maintenance',
    name: 'repair_module',
    title: 'Repair a module',
    description: 'A bot (usually the base) repairs the module of a bot within reach.',
    inputSchema: { botId, targetBotId, moduleId },
    run: (client, input) =>
      client.post(`/bots/${input.botId}/maintenance/repair`, {
        targetBotId: input.targetBotId,
        moduleId: input.moduleId
      })
  }),
  defineTool({
    scope: 'maintenance',
    name: 'disassemble_module',
    title: 'Take a module apart',
    description: 'Takes a module off a bot, for its parts.',
    inputSchema: { botId, targetBotId, moduleId },
    run: (client, input) =>
      client.post(`/bots/${input.botId}/maintenance/disassemble`, {
        targetBotId: input.targetBotId,
        moduleId: input.moduleId
      })
  })
]

export const baseTools = [
  defineTool({
    scope: 'base',
    name: 'deploy_base',
    title: 'Deploy a base',
    description:
      'Starts the game for a player who has no base: places a base on the map. The password is what other players need to connect to it.',
    inputSchema: {
      password: z.string().min(6).max(64).describe('Access password of the new base'),
      spawnSeed: z.string().optional().describe('A seed code to start near other players, like ALPHA-7K2')
    },
    run: (client, input) => client.post('/bots/base', { password: input.password, spawnSeed: input.spawnSeed })
  })
]
