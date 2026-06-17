import type { ToolDefinition } from '../../../../src/shared/types'
import { getCurrentTimeTool } from './get-current-time'
import { webSearchTool } from './web-search'
import { fileReadTool } from './file-read'
import { fileWriteTool } from './file-write'
import { shellExecTool } from './shell-exec'
import { rememberTool, recallTool, forgetTool } from './memory-manage'
import { taskPlanTool } from './task-plan'
import { codeSearchTool } from './code-search'
import { urlFetchTool } from './url-fetch'

export const builtinTools: ToolDefinition[] = [
  getCurrentTimeTool,
  webSearchTool,
  urlFetchTool,
  fileReadTool,
  fileWriteTool,
  shellExecTool,
  codeSearchTool,
  rememberTool,
  recallTool,
  forgetTool,
  taskPlanTool,
]
