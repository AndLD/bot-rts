import { actionTools } from './actions'
import { baseTools, fabricationTools } from './fabrication'
import { fileTools } from './files'
import { observationTools } from './observation'
import { scriptTools } from './scripts'
import { ToolDefinition } from './types'

export const allTools: ToolDefinition[] = [
  ...observationTools,
  ...baseTools,
  ...actionTools,
  ...fabricationTools,
  ...fileTools,
  ...scriptTools
]
