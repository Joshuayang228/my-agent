import type { ToolDefinition } from '../../../../src/shared/types'
import { getCurrentTimeTool } from './get-current-time'
import { webSearchTool } from './web-search'
import { fileReadTool } from './file-read'
import { fileWriteTool } from './file-write'
import { shellExecTool } from './shell-exec'

export const builtinTools: ToolDefinition[] = [
  getCurrentTimeTool,
  webSearchTool,
  fileReadTool,
  fileWriteTool,
  shellExecTool,
]
