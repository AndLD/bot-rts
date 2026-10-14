import { z, ZodRawShape } from 'zod'
import type { ApiClient } from '../api-client'

// One tool of the server: the call it makes on the public API, and the key scope that call needs. The scope is shown in the
// description, so that an AI knows why a restricted key cannot use a tool.
export interface ToolDefinition {
  name: string
  title: string
  description: string
  scope: string
  inputSchema: ZodRawShape
  // Observation only: the tool changes nothing in the game
  isReadOnly: boolean
  run(client: ApiClient, input: unknown): Promise<unknown>
}

interface ToolSpec<Shape extends ZodRawShape> {
  name: string
  title: string
  description: string
  scope: string
  inputSchema: Shape
  isReadOnly?: boolean
  run(client: ApiClient, input: z.infer<z.ZodObject<Shape>>): Promise<unknown>
}

// Declares a tool with an input type taken from its schema
export function defineTool<Shape extends ZodRawShape>(spec: ToolSpec<Shape>): ToolDefinition {
  return { isReadOnly: false, ...spec, run: spec.run as ToolDefinition['run'] }
}

export const botId = z.string().describe('The id of the bot (a base is a bot too)')
export const baseId = z.string().describe('The id of the base')
